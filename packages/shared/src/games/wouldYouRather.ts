import type { GameAction, GameDefinition, GamePlayer, TimedState } from '../engine/types'

/** A single Would You Rather prompt: two forced-choice options. */
export interface WyrPrompt {
  id: string
  a: string
  b: string
}

/** Tunable knobs. Host picks `rounds`; the timers are fixed defaults for now. */
export interface WyrSettings {
  rounds: number
  voteSeconds: number
  revealSeconds: number
}

/** The two forced-choice sides of every prompt. */
export type WyrChoice = 'a' | 'b'

/**
 * Full server state for a WYR game. Kept as one flat object because the
 * reducer needs to return `{ ...state, ... }` on every action — nested state
 * would just add spread noise. Votes are stored per-round so late-round joiners
 * (future feature) don't retroactively affect earlier tallies.
 */
export interface WyrState extends TimedState {
  phase: 'vote' | 'reveal' | 'finished'
  round: number
  prompts: WyrPrompt[]
  players: GamePlayer[]
  /** `votes[roundIndex][playerId] = choice`; indexed by `round - 1`. */
  votes: Array<Record<string, WyrChoice>>
  /** `playerId -> times they voted with the majority`. Ties award nothing. */
  scores: Record<string, number>
  settings: WyrSettings
}

interface LeaderboardRow {
  playerId: string
  nickname: string
  score: number
}

/**
 * What a phone renders. `vote` phase hides other players' choices (info-hiding
 * boundary — no one sees the split before reveal). `reveal` shows counts and
 * majority. `finished` is the leaderboard.
 */
export type WyrPlayerView =
  | {
      phase: 'vote'
      round: number
      totalRounds: number
      prompt: WyrPrompt
      yourChoice: WyrChoice | null
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      prompt: WyrPrompt
      counts: { a: number; b: number }
      yourChoice: WyrChoice | null
      majority: WyrChoice | 'tie'
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[] }

/**
 * What the TV renders. `vote` shows a progress meter (`votedCount / totalPlayers`)
 * without leaking who picked what. `reveal` shows the group split and running
 * leaderboard.
 */
export type WyrHostView =
  | {
      phase: 'vote'
      round: number
      totalRounds: number
      prompt: WyrPrompt
      votedCount: number
      totalPlayers: number
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      prompt: WyrPrompt
      counts: { a: number; b: number }
      majority: WyrChoice | 'tie'
      leaderboard: LeaderboardRow[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[] }

/** Players who count toward "everyone voted" — the game never waits on a dropped phone. */
function activePlayers(state: WyrState): GamePlayer[] {
  return state.players.filter((p) => p.connected)
}

function currentVotes(state: WyrState): Record<string, WyrChoice> {
  return state.votes[state.round - 1] ?? {}
}

function counts(state: WyrState): { a: number; b: number } {
  const votes = Object.values(currentVotes(state))
  return { a: votes.filter((v) => v === 'a').length, b: votes.filter((v) => v === 'b').length }
}

function majority(state: WyrState): WyrChoice | 'tie' {
  const c = counts(state)
  return c.a === c.b ? 'tie' : c.a > c.b ? 'a' : 'b'
}

/** Close voting: score the majority, move to reveal with an auto-advance deadline. */
function toReveal(state: WyrState, now: number): WyrState {
  const win = majority(state)
  const scores = { ...state.scores }
  if (win !== 'tie') {
    for (const [playerId, choice] of Object.entries(currentVotes(state))) {
      if (choice === win) scores[playerId] = (scores[playerId] ?? 0) + 1
    }
  }
  return {
    ...state,
    phase: 'reveal',
    scores,
    deadline: now + state.settings.revealSeconds * 1000,
  }
}

/** Leave reveal: next round's vote, or finish after the last round. */
function advance(state: WyrState, now: number): WyrState {
  if (state.round >= state.settings.rounds) return { ...state, phase: 'finished', deadline: null }
  return {
    ...state,
    phase: 'vote',
    round: state.round + 1,
    votes: [...state.votes, {}],
    deadline: now + state.settings.voteSeconds * 1000,
  }
}

function leaderboard(state: WyrState): LeaderboardRow[] {
  return state.players
    .map((p) => ({ playerId: p.id, nickname: p.nickname, score: state.scores[p.id] ?? 0 }))
    .sort((x, y) => y.score - x.score)
}

/**
 * Would You Rather: N rounds of secret A/B voting with a group-split reveal.
 *
 * The "score" is how often you voted with the majority — a fun stat rather
 * than a competition, so a tied round awards nothing and no one is ever
 * penalized for being outnumbered. Settings' `rounds` is clamped to the size
 * of the picked prompt list so the game can never demand more prompts than
 * exist in the pack.
 */
export const wouldYouRather: GameDefinition<WyrState, WyrSettings, WyrPrompt> = {
  id: 'would-you-rather',
  minPlayers: 2,
  defaultSettings: { rounds: 10, voteSeconds: 30, revealSeconds: 8 },

  init({ players, prompts, settings, now }) {
    return {
      phase: 'vote',
      round: 1,
      prompts,
      players,
      votes: [{}],
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      settings: { ...settings, rounds: Math.min(settings.rounds, prompts.length) },
      deadline: now + settings.voteSeconds * 1000,
    }
  },

  reducer(state, action: GameAction): WyrState {
    switch (action.type) {
      case 'PLAYER_INPUT': {
        // Votes are only valid during the vote phase, from seated players, with a real choice.
        if (state.phase !== 'vote') return state
        if (!state.players.some((p) => p.id === action.playerId)) return state
        const input = action.input as { choice?: unknown }
        if (input?.choice !== 'a' && input?.choice !== 'b') return state

        const votes = [...state.votes]
        votes[state.round - 1] = { ...currentVotes(state), [action.playerId]: input.choice }
        const next = { ...state, votes }
        const everyoneVoted = activePlayers(next).every((p) => votes[state.round - 1][p.id])
        return everyoneVoted ? toReveal(next, action.now) : next
      }
      case 'PLAYER_CONNECTION_CHANGED':
        return {
          ...state,
          players: state.players.map((player) =>
            player.id === action.playerId ? { ...player, connected: action.connected } : player,
          ),
        }
      case 'TIMER_EXPIRED':
      case 'HOST_ADVANCE': {
        if (state.phase === 'vote') return toReveal(state, action.now)
        if (state.phase === 'reveal') return advance(state, action.now)
        return state
      }
    }
  },

  playerView(state, playerId): WyrPlayerView {
    const prompt = state.prompts[state.round - 1]
    if (state.phase === 'vote') {
      return {
        phase: 'vote',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        yourChoice: currentVotes(state)[playerId] ?? null,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        counts: counts(state),
        yourChoice: currentVotes(state)[playerId] ?? null,
        majority: majority(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  hostView(state): WyrHostView {
    const prompt = state.prompts[state.round - 1]
    if (state.phase === 'vote') {
      return {
        phase: 'vote',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        votedCount: Object.keys(currentVotes(state)).length,
        totalPlayers: activePlayers(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        counts: counts(state),
        majority: majority(state),
        leaderboard: leaderboard(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  isFinished(state) {
    return state.phase === 'finished'
  },
}
