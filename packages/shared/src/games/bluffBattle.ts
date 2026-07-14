import type {
  GameDefinition,
  GameInputRejectionReason,
  GamePlayer,
  TimedState,
} from '../engine/types'

/** One question and its truthful answer for Bluff Battle. */
export interface BluffPrompt {
  id: string
  question: string
  answer: string
}

/** Timing and round-count settings for Bluff Battle. */
export interface BluffSettings {
  rounds: number
  bluffSeconds: number
  voteSeconds: number
  revealSeconds: number
}

/** One selectable answer in the vote phase. Truth flag + authors NEVER reach player views pre-reveal. */
export interface BluffOption {
  id: string
  text: string
  isTruth: boolean
  authorIds: string[]
}

/** Complete server-side state for a Bluff Battle game. */
export interface BluffState extends TimedState {
  phase: 'bluff' | 'vote' | 'reveal' | 'finished'
  round: number
  prompts: BluffPrompt[]
  players: GamePlayer[]
  /** bluff phase: playerId -> submitted fake answer (this round) */
  bluffs: Record<string, string>
  /** vote phase: built once when bluffing closes */
  options: BluffOption[]
  /** vote phase: voterId -> optionId */
  picks: Record<string, string>
  scores: Record<string, number>
  seed: number
  settings: BluffSettings
}

interface LeaderboardRow {
  playerId: string
  nickname: string
  score: number
}

/** Information a player may receive during each Bluff Battle phase. */
export type BluffPlayerView =
  | {
      phase: 'bluff'
      round: number
      totalRounds: number
      question: string
      submitted: boolean
      deadline: number | null
    }
  | {
      phase: 'vote'
      round: number
      totalRounds: number
      question: string
      /** truth/authors stripped; `yours` marks options this player wrote (unpickable) */
      options: Array<{ id: string; text: string; yours: boolean }>
      yourPick: string | null
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      question: string
      truth: string
      results: Array<{ text: string; isTruth: boolean; authors: string[]; pickedBy: string[] }>
      leaderboard: LeaderboardRow[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[] }

/** Information the host may receive during each Bluff Battle phase. */
export type BluffHostView =
  | {
      phase: 'bluff'
      round: number
      totalRounds: number
      question: string
      submittedCount: number
      totalPlayers: number
      deadline: number | null
    }
  | {
      phase: 'vote'
      round: number
      totalRounds: number
      question: string
      options: Array<{ id: string; text: string }>
      pickedCount: number
      totalPlayers: number
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      question: string
      truth: string
      results: Array<{ text: string; isTruth: boolean; authors: string[]; pickedBy: string[] }>
      leaderboard: LeaderboardRow[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[] }

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h >>> 0
}

const normalize = (s: string) => s.trim().toLowerCase()

function active(state: BluffState): GamePlayer[] {
  return state.players.filter((p) => p.connected)
}
function prompt(state: BluffState): BluffPrompt {
  return state.prompts[state.round - 1]
}
function nickname(state: BluffState, id: string): string {
  return state.players.find((p) => p.id === id)?.nickname ?? '?'
}

/**
 * Build vote options: the truth plus each distinct bluff (case-insensitive
 * dedup, co-authors merged). Order = hash shuffle so the truth's position
 * carries no signal; opaque positional IDs are assigned after ordering.
 */
function buildOptions(state: BluffState): BluffOption[] {
  const byText = new Map<string, Omit<BluffOption, 'id'>>()
  for (const [playerId, text] of Object.entries(state.bluffs)) {
    const key = normalize(text)
    const existing = byText.get(key)
    if (existing) existing.authorIds.push(playerId)
    else
      byText.set(key, {
        text,
        isTruth: false,
        authorIds: [playerId],
      })
  }
  const p = prompt(state)
  const options: Array<Omit<BluffOption, 'id'>> = [
    { text: p.answer, isTruth: true, authorIds: [] },
    ...byText.values(),
  ]
  return options
    .map((option) => {
      const key = normalize(option.text)
      return { option, key, rank: hash(`${key}:${state.seed}:${state.round}`) }
    })
    .sort((a, b) => a.rank - b.rank || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .map(({ option }, index) => ({ ...option, id: `opt-${index}` }))
}

function toVote(state: BluffState, now: number): BluffState {
  return {
    ...state,
    phase: 'vote',
    options: buildOptions(state),
    picks: {},
    deadline: now + state.settings.voteSeconds * 1000,
  }
}

/** Close voting: +2 truth-finders; +1 per fooled voter to each author of the picked bluff. */
function toReveal(state: BluffState, now: number): BluffState {
  const scores = { ...state.scores }
  for (const [voter, optionId] of Object.entries(state.picks)) {
    const option = state.options.find((o) => o.id === optionId)
    if (!option) continue
    if (option.isTruth) scores[voter] = (scores[voter] ?? 0) + 2
    else for (const author of option.authorIds) scores[author] = (scores[author] ?? 0) + 1
  }
  return { ...state, phase: 'reveal', scores, deadline: now + state.settings.revealSeconds * 1000 }
}

function nextRound(state: BluffState, now: number): BluffState {
  if (state.round >= state.settings.rounds) return { ...state, phase: 'finished', deadline: null }
  return {
    ...state,
    phase: 'bluff',
    round: state.round + 1,
    bluffs: {},
    options: [],
    picks: {},
    deadline: now + state.settings.bluffSeconds * 1000,
  }
}

function leaderboard(state: BluffState): LeaderboardRow[] {
  return state.players
    .map((p) => ({ playerId: p.id, nickname: p.nickname, score: state.scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score)
}

function results(state: BluffState) {
  return state.options.map((o) => ({
    text: o.text,
    isTruth: o.isTruth,
    authors: o.authorIds.map((id) => nickname(state, id)),
    pickedBy: Object.entries(state.picks)
      .filter(([, optionId]) => optionId === o.id)
      .map(([voter]) => nickname(state, voter)),
  }))
}

function inputRejection(
  state: BluffState,
  playerId: string,
  input: unknown,
): GameInputRejectionReason | undefined {
  if (state.phase !== 'bluff' || !state.players.some((player) => player.id === playerId)) return
  if (state.bluffs[playerId] !== undefined) return
  const text = (input as { text?: unknown })?.text
  if (typeof text !== 'string') return
  return normalize(text) === normalize(prompt(state).answer) ? 'matches-truth' : undefined
}

/** Bluff Battle: invent a believable fake answer, then find the real one. */
export const bluffBattle: GameDefinition<BluffState, BluffSettings, BluffPrompt> = {
  id: 'bluff-battle',
  minPlayers: 3,
  defaultSettings: { rounds: 5, bluffSeconds: 60, voteSeconds: 45, revealSeconds: 15 },

  inputRejection,

  init({ players, prompts, settings, now }) {
    return {
      phase: 'bluff',
      round: 1,
      prompts,
      players,
      bluffs: {},
      options: [],
      picks: {},
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      seed: now,
      settings: { ...settings, rounds: Math.min(settings.rounds, prompts.length) },
      deadline: now + settings.bluffSeconds * 1000,
    }
  },

  reducer(state, action): BluffState {
    switch (action.type) {
      case 'PLAYER_INPUT': {
        if (!state.players.some((p) => p.id === action.playerId)) return state

        if (state.phase === 'bluff') {
          if (state.bluffs[action.playerId] !== undefined) return state
          const text = (action.input as { text?: unknown })?.text
          if (typeof text !== 'string') return state
          const trimmed = text.trim()
          if (!trimmed || trimmed.length > 100) return state
          // A "bluff" equal to the truth would out the real answer — reject it.
          if (inputRejection(state, action.playerId, action.input) === 'matches-truth') return state
          const bluffs = { ...state.bluffs, [action.playerId]: trimmed }
          const next = { ...state, bluffs }
          return active(next).every((p) => bluffs[p.id]) ? toVote(next, action.now) : next
        }

        if (state.phase === 'vote') {
          if (state.picks[action.playerId] !== undefined) return state
          const optionId = (action.input as { optionId?: unknown })?.optionId
          if (typeof optionId !== 'string') return state
          const option = state.options.find((o) => o.id === optionId)
          if (!option || option.authorIds.includes(action.playerId)) return state
          const picks = { ...state.picks, [action.playerId]: optionId }
          const next = { ...state, picks }
          return active(next).every((p) => picks[p.id]) ? toReveal(next, action.now) : next
        }
        return state
      }
      case 'PLAYER_CONNECTION_CHANGED': {
        const next = {
          ...state,
          players: state.players.map((player) =>
            player.id === action.playerId ? { ...player, connected: action.connected } : player,
          ),
        }
        const connectedPlayers = active(next)
        if (
          connectedPlayers.length > 0 &&
          next.phase === 'bluff' &&
          connectedPlayers.every((player) => next.bluffs[player.id])
        ) {
          return toVote(next, action.now)
        }
        if (
          connectedPlayers.length > 0 &&
          next.phase === 'vote' &&
          connectedPlayers.every((player) => next.picks[player.id])
        ) {
          return toReveal(next, action.now)
        }
        return next
      }
      case 'TIMER_EXPIRED':
      case 'HOST_ADVANCE':
        if (state.phase === 'bluff') return toVote(state, action.now)
        if (state.phase === 'vote') return toReveal(state, action.now)
        if (state.phase === 'reveal') return nextRound(state, action.now)
        return state
    }
  },

  playerView(state, playerId): BluffPlayerView {
    const q = prompt(state)
    if (state.phase === 'bluff') {
      return {
        phase: 'bluff',
        round: state.round,
        totalRounds: state.settings.rounds,
        question: q.question,
        submitted: state.bluffs[playerId] !== undefined,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'vote') {
      return {
        phase: 'vote',
        round: state.round,
        totalRounds: state.settings.rounds,
        question: q.question,
        // Strip isTruth/authorIds — phones must not be able to cheat via devtools.
        options: state.options.map((o) => ({
          id: o.id,
          text: o.text,
          yours: o.authorIds.includes(playerId),
        })),
        yourPick: state.picks[playerId] ?? null,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        question: q.question,
        truth: q.answer,
        results: results(state),
        leaderboard: leaderboard(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  hostView(state): BluffHostView {
    const q = prompt(state)
    if (state.phase === 'bluff') {
      return {
        phase: 'bluff',
        round: state.round,
        totalRounds: state.settings.rounds,
        question: q.question,
        submittedCount: active(state).filter((player) => state.bluffs[player.id] !== undefined)
          .length,
        totalPlayers: active(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'vote') {
      return {
        phase: 'vote',
        round: state.round,
        totalRounds: state.settings.rounds,
        question: q.question,
        options: state.options.map((o) => ({ id: o.id, text: o.text })), // TV shows options, never the truth
        pickedCount: active(state).filter((player) => state.picks[player.id] !== undefined).length,
        totalPlayers: active(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        question: q.question,
        truth: q.answer,
        results: results(state),
        leaderboard: leaderboard(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  isFinished: (state) => state.phase === 'finished',
}
