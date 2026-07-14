import type { GameDefinition, GamePlayer, TimedState } from '../engine/types'

/** A single Never Have I Ever prompt completing the phrase "Never have I ever …". */
export interface NhiePrompt {
  id: string
  text: string
}

export interface NhieSettings {
  rounds: number
  answerSeconds: number
  revealSeconds: number
  /**
   * `'names'` shows who said "I have"; `'count'` shows only how many. Anonymous
   * mode is the spec's default for larger groups where confessions carry more
   * risk; the host picks per session.
   */
  revealMode: 'names' | 'count'
  /** When true, players are knocked out at `strikes` yeses; last standing wins. */
  elimination: boolean
  strikes: number
}

/**
 * Full server state. `strikes` doubles as "total I-haves" in classic mode
 * and as the elimination counter in elimination mode — the elimination
 * check compares it against `settings.strikes`.
 */
export interface NhieState extends TimedState {
  phase: 'answer' | 'reveal' | 'finished'
  round: number
  prompts: NhiePrompt[]
  players: GamePlayer[]
  /** `answers[roundIndex][playerId] = true` means "I have"; `false` = "never". */
  answers: Array<Record<string, boolean>>
  /** `playerId -> total "I have" count` (elimination compares this to `settings.strikes`). */
  strikes: Record<string, number>
  settings: NhieSettings
}

interface LeaderboardRow {
  playerId: string
  nickname: string
  score: number
}

export type NhiePlayerView =
  | {
      phase: 'answer'
      round: number
      totalRounds: number
      prompt: NhiePrompt
      yourAnswer: boolean | null
      eliminated: boolean
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      prompt: NhiePrompt
      yesCount: number
      yesNames?: string[]
      yourAnswer: boolean | null
      eliminatedNow: string[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[]; elimination: boolean }

export type NhieHostView =
  | {
      phase: 'answer'
      round: number
      totalRounds: number
      prompt: NhiePrompt
      answeredCount: number
      totalPlayers: number
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      prompt: NhiePrompt
      yesCount: number
      yesNames?: string[]
      eliminatedNow: string[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[]; elimination: boolean }

function isEliminated(state: NhieState, playerId: string): boolean {
  return state.settings.elimination && (state.strikes[playerId] ?? 0) >= state.settings.strikes
}

/** Players the round waits on: connected AND still in the game. */
function active(state: NhieState): GamePlayer[] {
  return state.players.filter((p) => p.connected && !isEliminated(state, p.id))
}

function current(state: NhieState): Record<string, boolean> {
  return state.answers[state.round - 1] ?? {}
}

function toReveal(state: NhieState, now: number): NhieState {
  const strikes = { ...state.strikes }
  for (const [playerId, done] of Object.entries(current(state))) {
    if (done) strikes[playerId] = (strikes[playerId] ?? 0) + 1
  }
  return {
    ...state,
    phase: 'reveal',
    strikes,
    deadline: now + state.settings.revealSeconds * 1000,
  }
}

function advance(state: NhieState, now: number): NhieState {
  const finished =
    state.round >= state.settings.rounds ||
    (state.settings.elimination && active(state).length <= 1)
  if (finished) return { ...state, phase: 'finished', deadline: null }
  return {
    ...state,
    phase: 'answer',
    round: state.round + 1,
    answers: [...state.answers, {}],
    deadline: now + state.settings.answerSeconds * 1000,
  }
}

/** Fewest "I have" answers first — the most innocent player tops the board. */
function leaderboard(state: NhieState): LeaderboardRow[] {
  return state.players
    .map((p) => ({ playerId: p.id, nickname: p.nickname, score: state.strikes[p.id] ?? 0 }))
    .sort((a, b) => a.score - b.score)
}

/** Nicknames of players eliminated by THIS round's strikes. */
function eliminatedNow(state: NhieState): string[] {
  if (!state.settings.elimination) return []
  return state.players
    .filter((p) => current(state)[p.id] && (state.strikes[p.id] ?? 0) === state.settings.strikes)
    .map((p) => p.nickname)
}

function yesNames(state: NhieState): string[] {
  return state.players.filter((p) => current(state)[p.id]).map((p) => p.nickname)
}

/**
 * Never Have I Ever: private yes/no confessions per prompt with a
 * configurable reveal. Two modes:
 * - **classic** (default): all rounds run, "score" = total I-haves.
 * - **elimination**: player is out at `settings.strikes` yeses; last standing wins.
 */
export const neverHaveIEver: GameDefinition<NhieState, NhieSettings, NhiePrompt> = {
  id: 'never-have-i-ever',
  minPlayers: 3,
  defaultSettings: {
    rounds: 10,
    answerSeconds: 20,
    revealSeconds: 10,
    revealMode: 'names',
    elimination: false,
    strikes: 3,
  },

  init({ players, prompts, settings, now }) {
    return {
      phase: 'answer',
      round: 1,
      prompts,
      players,
      answers: [{}],
      strikes: Object.fromEntries(players.map((p) => [p.id, 0])),
      settings: { ...settings, rounds: Math.min(settings.rounds, prompts.length) },
      deadline: now + settings.answerSeconds * 1000,
    }
  },

  reducer(state, action): NhieState {
    switch (action.type) {
      case 'PLAYER_INPUT': {
        if (state.phase !== 'answer') return state
        if (!state.players.some((p) => p.id === action.playerId)) return state
        if (isEliminated(state, action.playerId)) return state
        const done = (action.input as { done?: unknown })?.done
        if (typeof done !== 'boolean') return state

        const answers = [...state.answers]
        answers[state.round - 1] = { ...current(state), [action.playerId]: done }
        const next = { ...state, answers }
        const everyone = active(next).every((p) => answers[state.round - 1][p.id] !== undefined)
        return everyone ? toReveal(next, action.now) : next
      }
      case 'TIMER_EXPIRED':
      case 'HOST_ADVANCE':
        if (state.phase === 'answer') return toReveal(state, action.now)
        if (state.phase === 'reveal') return advance(state, action.now)
        return state
    }
  },

  playerView(state, playerId): NhiePlayerView {
    const prompt = state.prompts[state.round - 1]
    if (state.phase === 'answer') {
      return {
        phase: 'answer',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        yourAnswer: current(state)[playerId] ?? null,
        eliminated: isEliminated(state, playerId),
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        yesCount: yesNames(state).length,
        ...(state.settings.revealMode === 'names' ? { yesNames: yesNames(state) } : {}),
        yourAnswer: current(state)[playerId] ?? null,
        eliminatedNow: eliminatedNow(state),
      }
    }
    return {
      phase: 'finished',
      leaderboard: leaderboard(state),
      elimination: state.settings.elimination,
    }
  },

  hostView(state): NhieHostView {
    const prompt = state.prompts[state.round - 1]
    if (state.phase === 'answer') {
      return {
        phase: 'answer',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        answeredCount: Object.keys(current(state)).length,
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
        yesCount: yesNames(state).length,
        ...(state.settings.revealMode === 'names' ? { yesNames: yesNames(state) } : {}),
        eliminatedNow: eliminatedNow(state),
      }
    }
    return {
      phase: 'finished',
      leaderboard: leaderboard(state),
      elimination: state.settings.elimination,
    }
  },

  isFinished: (state) => state.phase === 'finished',
}
