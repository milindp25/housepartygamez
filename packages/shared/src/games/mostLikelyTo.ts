import type { GameDefinition, GamePlayer, TimedState } from '../engine/types'

/** A single Most Likely To prompt: one open-ended phrase like "become famous accidentally". */
export interface MltPrompt {
  id: string
  text: string
}

export interface MltSettings {
  rounds: number
  voteSeconds: number
  revealSeconds: number
  /**
   * When true (default), the reveal shows counts only — never who voted for
   * whom. Groups often care about this: naming names changes the game from
   * "who fits the vibe?" to accountability, which the spec calls out.
   */
  anonymousVotes: boolean
}

/**
 * Full server state for a Most Likely To game. Kept flat for the same
 * reducer-spread reasons as WYR. Votes are per-round so late-joiners never
 * retroactively affect earlier tallies.
 */
export interface MltState extends TimedState {
  phase: 'vote' | 'reveal' | 'finished'
  round: number
  prompts: MltPrompt[]
  players: GamePlayer[]
  /** `votes[roundIndex][voterId] = targetId`. */
  votes: Array<Record<string, string>>
  /** `playerId -> total votes received across rounds`. */
  scores: Record<string, number>
  settings: MltSettings
}

/**
 * One row of the round's tally. `voters` is present only when
 * `settings.anonymousVotes === false`; the server strips it from views
 * otherwise, so anonymous mode is enforced at the view boundary.
 */
export interface MltTallyRow {
  playerId: string
  nickname: string
  count: number
  voters?: string[]
}

export type MltPlayerView =
  | {
      phase: 'vote'
      round: number
      totalRounds: number
      prompt: MltPrompt
      candidates: Array<{ id: string; nickname: string }>
      yourVote: string | null
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      prompt: MltPrompt
      tally: MltTallyRow[]
    }
  | {
      phase: 'finished'
      leaderboard: Array<{ playerId: string; nickname: string; score: number }>
    }

export type MltHostView =
  | {
      phase: 'vote'
      round: number
      totalRounds: number
      prompt: MltPrompt
      votedCount: number
      totalPlayers: number
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      prompt: MltPrompt
      tally: MltTallyRow[]
    }
  | {
      phase: 'finished'
      leaderboard: Array<{ playerId: string; nickname: string; score: number }>
    }

function active(state: MltState): GamePlayer[] {
  return state.players.filter((p) => p.connected)
}
function currentVotes(state: MltState): Record<string, string> {
  return state.votes[state.round - 1] ?? {}
}

function tally(state: MltState): MltTallyRow[] {
  const votes = currentVotes(state)
  return state.players
    .map((p) => {
      const voters = Object.entries(votes)
        .filter(([, target]) => target === p.id)
        .map(([voterId]) => state.players.find((x) => x.id === voterId)?.nickname ?? '?')
      const row: MltTallyRow = { playerId: p.id, nickname: p.nickname, count: voters.length }
      if (!state.settings.anonymousVotes) row.voters = voters
      return row
    })
    .sort((a, b) => b.count - a.count)
}

function toReveal(state: MltState, now: number): MltState {
  const scores = { ...state.scores }
  for (const target of Object.values(currentVotes(state)))
    scores[target] = (scores[target] ?? 0) + 1
  return {
    ...state,
    phase: 'reveal',
    scores,
    deadline: now + state.settings.revealSeconds * 1000,
  }
}

function advance(state: MltState, now: number): MltState {
  if (state.round >= state.settings.rounds) return { ...state, phase: 'finished', deadline: null }
  return {
    ...state,
    phase: 'vote',
    round: state.round + 1,
    votes: [...state.votes, {}],
    deadline: now + state.settings.voteSeconds * 1000,
  }
}

function leaderboard(state: MltState) {
  return state.players
    .map((p) => ({ playerId: p.id, nickname: p.nickname, score: state.scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score)
}

/**
 * Most Likely To: everyone secretly votes for the player who best fits the
 * prompt. `minPlayers` is 3 — two players just point at each other. The
 * reducer rejects self-votes and unknown targets silently (client bugs, not
 * user-visible errors).
 */
export const mostLikelyTo: GameDefinition<MltState, MltSettings, MltPrompt> = {
  id: 'most-likely-to',
  minPlayers: 3,
  defaultSettings: { rounds: 10, voteSeconds: 30, revealSeconds: 10, anonymousVotes: true },

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

  reducer(state, action): MltState {
    switch (action.type) {
      case 'PLAYER_INPUT': {
        if (state.phase !== 'vote') return state
        if (!state.players.some((p) => p.id === action.playerId)) return state
        const target = (action.input as { targetId?: unknown })?.targetId
        // Self-votes defeat the game's point; unknown targets are client bugs — both no-ops.
        if (typeof target !== 'string' || target === action.playerId) return state
        if (!state.players.some((p) => p.id === target)) return state

        const votes = [...state.votes]
        votes[state.round - 1] = { ...currentVotes(state), [action.playerId]: target }
        const next = { ...state, votes }
        return active(next).every((p) => votes[state.round - 1][p.id])
          ? toReveal(next, action.now)
          : next
      }
      case 'PLAYER_CONNECTION_CHANGED':
        return {
          ...state,
          players: state.players.map((player) =>
            player.id === action.playerId ? { ...player, connected: action.connected } : player,
          ),
        }
      case 'TIMER_EXPIRED':
      case 'HOST_ADVANCE':
        if (state.phase === 'vote') return toReveal(state, action.now)
        if (state.phase === 'reveal') return advance(state, action.now)
        return state
    }
  },

  playerView(state, playerId): MltPlayerView {
    const prompt = state.prompts[state.round - 1]
    if (state.phase === 'vote') {
      return {
        phase: 'vote',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        candidates: state.players
          .filter((p) => p.id !== playerId)
          .map(({ id, nickname }) => ({ id, nickname })),
        yourVote: currentVotes(state)[playerId] ?? null,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        tally: tally(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  hostView(state): MltHostView {
    const prompt = state.prompts[state.round - 1]
    if (state.phase === 'vote') {
      return {
        phase: 'vote',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        votedCount: Object.keys(currentVotes(state)).length,
        totalPlayers: active(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        tally: tally(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  isFinished: (state) => state.phase === 'finished',
}
