import type { GameDefinition, GamePlayer, TimedState } from '../engine/types'

/** A single Imposter prompt: the secret word and its category (for hint mode). */
export interface ImposterPrompt {
  id: string
  word: string
  category: string
}

export interface ImposterSettings {
  rounds: number
  /** `'category'` = imposter sees the word's category; `'none'` = they fly blind. */
  hint: 'category' | 'none'
  clueSeconds: number
  voteSeconds: number
  revealSeconds: number
}

/**
 * Full server state. `imposterId` is picked in `init` from a hash-seed of
 * `now`; per-round rotation uses the same seed + round number so the pick
 * stays reproducible for tests but unpredictable for players.
 */
export interface ImposterState extends TimedState {
  phase: 'word' | 'clues' | 'vote' | 'reveal' | 'finished'
  round: number
  prompts: ImposterPrompt[]
  players: GamePlayer[]
  /** Chosen per round via seeded hash — see `pickImposter`. */
  imposterId: string
  /** Deterministic order in which players give spoken clues this round. */
  speakingOrder: string[]
  /** Index into `speakingOrder` during the clues phase. */
  speakerIndex: number
  /** word phase: `playerId -> confirmed they've read their word`. */
  ready: Record<string, boolean>
  /** vote phase: `voterId -> suspectId`. */
  votes: Record<string, string>
  scores: Record<string, number>
  /** Seed captured at init so per-round rotation stays pure AND unpredictable. */
  seed: number
  settings: ImposterSettings
}

interface LeaderboardRow {
  playerId: string
  nickname: string
  score: number
}

export type ImposterPlayerView =
  | {
      phase: 'word'
      round: number
      totalRounds: number
      isImposter: boolean
      word?: string
      hint?: string
      ready: boolean
      deadline: number | null
    }
  | {
      phase: 'clues'
      round: number
      totalRounds: number
      isImposter: boolean
      word?: string
      hint?: string
      currentSpeaker: string
      youAreSpeaking: boolean
      deadline: number | null
    }
  | {
      phase: 'vote'
      round: number
      totalRounds: number
      isImposter: boolean
      candidates: Array<{ id: string; nickname: string }>
      yourVote: string | null
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      imposterNickname: string
      word: string
      caught: boolean
      tally: Array<{ nickname: string; count: number }>
      leaderboard: LeaderboardRow[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[] }

export type ImposterHostView =
  | {
      phase: 'word'
      round: number
      totalRounds: number
      readyCount: number
      totalPlayers: number
      deadline: number | null
    }
  | {
      phase: 'clues'
      round: number
      totalRounds: number
      speakingOrder: string[]
      currentSpeaker: string
      deadline: number | null
    }
  | {
      phase: 'vote'
      round: number
      totalRounds: number
      votedCount: number
      totalPlayers: number
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      imposterNickname: string
      word: string
      caught: boolean
      tally: Array<{ nickname: string; count: number }>
      leaderboard: LeaderboardRow[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[] }

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h >>> 0
}

/**
 * Round's imposter = lowest `hash(playerId + seed + round)`. Pure and test-
 * fixable (fix `now` at init), but effectively random to players since
 * `seed` is the game's start timestamp.
 */
function pickImposter(players: GamePlayer[], seed: number, round: number): string {
  return [...players].sort((a, b) => hash(a.id + seed + round) - hash(b.id + seed + round))[0].id
}

function speakingOrder(players: GamePlayer[], seed: number, round: number): string[] {
  return [...players]
    .sort((a, b) => hash(round + a.id + seed) - hash(round + b.id + seed))
    .map((p) => p.id)
}

function active(state: ImposterState): GamePlayer[] {
  return state.players.filter((p) => p.connected)
}

function tally(state: ImposterState): Map<string, number> {
  const t = new Map<string, number>()
  for (const suspect of Object.values(state.votes)) t.set(suspect, (t.get(suspect) ?? 0) + 1)
  return t
}

/** Caught = the imposter is the STRICT top vote-getter. A tie lets them slip away. */
function isCaught(state: ImposterState): boolean {
  const t = tally(state)
  const imposterVotes = t.get(state.imposterId) ?? 0
  if (imposterVotes === 0) return false
  return [...t.entries()].every(([id, n]) => id === state.imposterId || n < imposterVotes)
}

function toReveal(state: ImposterState, now: number): ImposterState {
  const scores = { ...state.scores }
  for (const [voter, suspect] of Object.entries(state.votes)) {
    if (suspect === state.imposterId && voter !== state.imposterId)
      scores[voter] = (scores[voter] ?? 0) + 1
  }
  if (!isCaught(state)) scores[state.imposterId] = (scores[state.imposterId] ?? 0) + 2
  return {
    ...state,
    phase: 'reveal',
    scores,
    deadline: now + state.settings.revealSeconds * 1000,
  }
}

function nextRound(state: ImposterState): ImposterState {
  if (state.round >= state.settings.rounds) return { ...state, phase: 'finished', deadline: null }
  const round = state.round + 1
  return {
    ...state,
    phase: 'word',
    round,
    imposterId: pickImposter(state.players, state.seed, round),
    speakingOrder: speakingOrder(state.players, state.seed, round),
    speakerIndex: 0,
    ready: {},
    votes: {},
    deadline: null,
  }
}

function leaderboard(state: ImposterState): LeaderboardRow[] {
  return state.players
    .map((p) => ({ playerId: p.id, nickname: p.nickname, score: state.scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score)
}

function nickname(state: ImposterState, id: string): string {
  return state.players.find((p) => p.id === id)?.nickname ?? '?'
}

/**
 * Imposter: everyone shares a secret word except one player. Clues are
 * spoken out loud (the app shows whose turn it is), then the room votes.
 * `minPlayers` is 4 — three players makes the vote too swingy.
 */
export const imposter: GameDefinition<ImposterState, ImposterSettings, ImposterPrompt> = {
  id: 'imposter',
  minPlayers: 4,
  defaultSettings: {
    rounds: 5,
    hint: 'category',
    clueSeconds: 25,
    voteSeconds: 45,
    revealSeconds: 12,
  },

  init({ players, prompts, settings, now }) {
    const seed = now
    return {
      phase: 'word',
      round: 1,
      prompts,
      players,
      imposterId: pickImposter(players, seed, 1),
      speakingOrder: speakingOrder(players, seed, 1),
      speakerIndex: 0,
      ready: {},
      votes: {},
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      seed,
      settings: { ...settings, rounds: Math.min(settings.rounds, prompts.length) },
      deadline: null,
    }
  },

  reducer(state, action): ImposterState {
    switch (action.type) {
      case 'PLAYER_INPUT': {
        if (!state.players.some((p) => p.id === action.playerId)) return state

        if (state.phase === 'word') {
          if ((action.input as { ready?: unknown })?.ready !== true) return state
          const ready = { ...state.ready, [action.playerId]: true }
          const next = { ...state, ready }
          if (active(next).every((p) => ready[p.id])) {
            return {
              ...next,
              phase: 'clues',
              deadline: action.now + state.settings.clueSeconds * 1000,
            }
          }
          return next
        }

        if (state.phase === 'vote') {
          const suspect = (action.input as { suspectId?: unknown })?.suspectId
          if (typeof suspect !== 'string' || suspect === action.playerId) return state
          if (!state.players.some((p) => p.id === suspect)) return state
          const votes = { ...state.votes, [action.playerId]: suspect }
          const next = { ...state, votes }
          return active(next).every((p) => votes[p.id]) ? toReveal(next, action.now) : next
        }
        return state
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
        if (state.phase === 'word') {
          return {
            ...state,
            phase: 'clues',
            deadline: action.now + state.settings.clueSeconds * 1000,
          }
        }
        if (state.phase === 'clues') {
          // Advance to the next speaker; after the last, open voting.
          if (state.speakerIndex + 1 < state.speakingOrder.length) {
            return {
              ...state,
              speakerIndex: state.speakerIndex + 1,
              deadline: action.now + state.settings.clueSeconds * 1000,
            }
          }
          return {
            ...state,
            phase: 'vote',
            deadline: action.now + state.settings.voteSeconds * 1000,
          }
        }
        if (state.phase === 'vote') return toReveal(state, action.now)
        if (state.phase === 'reveal') return nextRound(state)
        return state
      }
    }
  },

  playerView(state, playerId): ImposterPlayerView {
    const isImposter = state.imposterId === playerId
    const prompt = state.prompts[state.round - 1]
    // The secret: only non-imposters ever receive `word`; the imposter gets
    // `hint` (or nothing). This is enforced HERE, not in the client.
    const secret = isImposter
      ? state.settings.hint === 'category'
        ? { hint: prompt.category }
        : {}
      : { word: prompt.word }

    if (state.phase === 'word') {
      return {
        phase: 'word',
        round: state.round,
        totalRounds: state.settings.rounds,
        isImposter,
        ...secret,
        ready: state.ready[playerId] === true,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'clues') {
      return {
        phase: 'clues',
        round: state.round,
        totalRounds: state.settings.rounds,
        isImposter,
        ...secret,
        currentSpeaker: nickname(state, state.speakingOrder[state.speakerIndex]),
        youAreSpeaking: state.speakingOrder[state.speakerIndex] === playerId,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'vote') {
      return {
        phase: 'vote',
        round: state.round,
        totalRounds: state.settings.rounds,
        isImposter,
        candidates: state.players
          .filter((p) => p.id !== playerId)
          .map(({ id, nickname: n }) => ({ id, nickname: n })),
        yourVote: state.votes[playerId] ?? null,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        imposterNickname: nickname(state, state.imposterId),
        word: prompt.word,
        caught: isCaught(state),
        tally: [...tally(state).entries()]
          .map(([id, count]) => ({ nickname: nickname(state, id), count }))
          .sort((a, b) => b.count - a.count),
        leaderboard: leaderboard(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  hostView(state): ImposterHostView {
    if (state.phase === 'word') {
      return {
        phase: 'word',
        round: state.round,
        totalRounds: state.settings.rounds,
        readyCount: Object.keys(state.ready).length,
        totalPlayers: active(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'clues') {
      return {
        phase: 'clues',
        round: state.round,
        totalRounds: state.settings.rounds,
        speakingOrder: state.speakingOrder.map((id) => nickname(state, id)),
        currentSpeaker: nickname(state, state.speakingOrder[state.speakerIndex]),
        deadline: state.deadline,
      }
    }
    if (state.phase === 'vote') {
      return {
        phase: 'vote',
        round: state.round,
        totalRounds: state.settings.rounds,
        votedCount: Object.keys(state.votes).length,
        totalPlayers: active(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      const prompt = state.prompts[state.round - 1]
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        imposterNickname: nickname(state, state.imposterId),
        word: prompt.word,
        caught: isCaught(state),
        tally: [...tally(state).entries()]
          .map(([id, count]) => ({ nickname: nickname(state, id), count }))
          .sort((a, b) => b.count - a.count),
        leaderboard: leaderboard(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  isFinished: (state) => state.phase === 'finished',
}
