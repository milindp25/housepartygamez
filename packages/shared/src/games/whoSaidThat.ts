import type { GameDefinition, GamePlayer, TimedState } from '../engine/types'

/** A prompt asking for a short, personal answer (e.g. "What was your weirdest dream?"). */
export interface WstPrompt {
  id: string
  text: string
}

export interface WstSettings {
  answerSeconds: number
  guessSeconds: number
  revealSeconds: number
}

/**
 * Full server state. `order` is the display order for the guessing phase —
 * populated when answering closes — and `turn` walks through it. Both go
 * back to `[]` / `0` before `answer` is entered because they're meaningless
 * until the round transitions.
 */
export interface WstState extends TimedState {
  phase: 'answer' | 'guess' | 'reveal' | 'finished'
  prompt: WstPrompt
  players: GamePlayer[]
  /** `playerId -> their submitted answer` (trimmed, ≤ 140 chars). */
  answers: Record<string, string>
  /** `playerId`s whose answers are shown, in display order. Set at answer-close. */
  order: string[]
  /** Index into `order` — whose answer is on screen now. */
  turn: number
  /** `guesses[turn][guesserId] = suspectedAuthorId`. */
  guesses: Array<Record<string, string>>
  scores: Record<string, number>
  settings: WstSettings
}

interface LeaderboardRow {
  playerId: string
  nickname: string
  score: number
}

export type WstPlayerView =
  | { phase: 'answer'; prompt: WstPrompt; submitted: boolean; deadline: number | null }
  | {
      phase: 'guess'
      prompt: WstPrompt
      turn: number
      totalTurns: number
      answerText: string
      /** True → this answer is YOURS: sit tight and act natural. */
      isYours: boolean
      candidates: Array<{ id: string; nickname: string }>
      yourGuess: string | null
      deadline: number | null
    }
  | {
      phase: 'reveal'
      prompt: WstPrompt
      turn: number
      totalTurns: number
      answerText: string
      authorNickname: string
      correctGuessers: string[]
      leaderboard: LeaderboardRow[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[] }

export type WstHostView =
  | {
      phase: 'answer'
      prompt: WstPrompt
      answeredCount: number
      totalPlayers: number
      deadline: number | null
    }
  | {
      phase: 'guess'
      prompt: WstPrompt
      turn: number
      totalTurns: number
      answerText: string
      guessedCount: number
      totalGuessers: number
      deadline: number | null
    }
  | {
      phase: 'reveal'
      prompt: WstPrompt
      turn: number
      totalTurns: number
      answerText: string
      authorNickname: string
      correctGuessers: string[]
      leaderboard: LeaderboardRow[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[] }

/**
 * Deterministic pseudo-shuffle: sort by a hash of (playerId + promptId).
 * Reducers must stay pure (no `Math.random`), and this is stable for tests
 * while looking arbitrary to players — same inputs always produce the same
 * display order, but the order isn't guessable from either input alone.
 */
function displayOrder(answerIds: string[], promptId: string): string[] {
  const hash = (s: string) => {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
    return h >>> 0
  }
  return [...answerIds].sort((a, b) => hash(a + promptId) - hash(b + promptId))
}

function active(state: WstState): GamePlayer[] {
  return state.players.filter((p) => p.connected)
}
function currentAuthor(state: WstState): string {
  return state.order[state.turn]
}
function currentGuesses(state: WstState): Record<string, string> {
  return state.guesses[state.turn] ?? {}
}
/** Everyone still connected except the current answer's author. */
function eligibleGuessers(state: WstState): GamePlayer[] {
  return active(state).filter((p) => p.id !== currentAuthor(state))
}

function leaderboard(state: WstState): LeaderboardRow[] {
  return state.players
    .map((p) => ({ playerId: p.id, nickname: p.nickname, score: state.scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score)
}

/** Close answering. With fewer than 2 answers there is nothing to guess — finish. */
function toGuessing(state: WstState, now: number): WstState {
  const order = displayOrder(Object.keys(state.answers), state.prompt.id)
  if (order.length < 2) return { ...state, phase: 'finished', order, deadline: null }
  return {
    ...state,
    phase: 'guess',
    order,
    turn: 0,
    guesses: [{}],
    deadline: now + state.settings.guessSeconds * 1000,
  }
}

/** Close guessing: +1 per correct guesser, +1 to the author per fooled guesser. */
function toReveal(state: WstState, now: number): WstState {
  const author = currentAuthor(state)
  const scores = { ...state.scores }
  for (const [guesser, suspect] of Object.entries(currentGuesses(state))) {
    if (suspect === author) scores[guesser] = (scores[guesser] ?? 0) + 1
    else scores[author] = (scores[author] ?? 0) + 1
  }
  return {
    ...state,
    phase: 'reveal',
    scores,
    deadline: now + state.settings.revealSeconds * 1000,
  }
}

function advance(state: WstState, now: number): WstState {
  if (state.turn + 1 >= state.order.length) return { ...state, phase: 'finished', deadline: null }
  return {
    ...state,
    phase: 'guess',
    turn: state.turn + 1,
    guesses: [...state.guesses, {}],
    deadline: now + state.settings.guessSeconds * 1000,
  }
}

/**
 * Who Said That: everyone answers a personal question privately, then the
 * group guesses each answer's author. Points for spotting authors, points
 * for going unspotted.
 */
export const whoSaidThat: GameDefinition<WstState, WstSettings, WstPrompt> = {
  id: 'who-said-that',
  minPlayers: 3,
  defaultSettings: { answerSeconds: 90, guessSeconds: 45, revealSeconds: 12 },

  init({ players, prompts, settings, now }) {
    return {
      phase: 'answer',
      prompt: prompts[0],
      players,
      answers: {},
      order: [],
      turn: 0,
      guesses: [],
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      settings,
      deadline: now + settings.answerSeconds * 1000,
    }
  },

  reducer(state, action): WstState {
    switch (action.type) {
      case 'PLAYER_INPUT': {
        if (!state.players.some((p) => p.id === action.playerId)) return state

        if (state.phase === 'answer') {
          const text = (action.input as { text?: unknown })?.text
          if (typeof text !== 'string') return state
          const trimmed = text.trim()
          if (trimmed.length === 0 || trimmed.length > 140) return state
          const next = { ...state, answers: { ...state.answers, [action.playerId]: trimmed } }
          const everyone = active(next).every((p) => next.answers[p.id] !== undefined)
          return everyone ? toGuessing(next, action.now) : next
        }

        if (state.phase === 'guess') {
          const authorId = (action.input as { authorId?: unknown })?.authorId
          if (typeof authorId !== 'string') return state
          // The author sits this one out; nobody may point at themselves.
          if (action.playerId === currentAuthor(state)) return state
          if (authorId === action.playerId) return state
          if (!state.players.some((p) => p.id === authorId)) return state

          const guesses = [...state.guesses]
          guesses[state.turn] = { ...currentGuesses(state), [action.playerId]: authorId }
          const next = { ...state, guesses }
          const everyone = eligibleGuessers(next).every((p) => guesses[state.turn][p.id])
          return everyone ? toReveal(next, action.now) : next
        }
        return state
      }
      case 'TIMER_EXPIRED':
      case 'HOST_ADVANCE':
        if (state.phase === 'answer') return toGuessing(state, action.now)
        if (state.phase === 'guess') return toReveal(state, action.now)
        if (state.phase === 'reveal') return advance(state, action.now)
        return state
    }
  },

  playerView(state, playerId): WstPlayerView {
    if (state.phase === 'answer') {
      return {
        phase: 'answer',
        prompt: state.prompt,
        submitted: state.answers[playerId] !== undefined,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'guess') {
      const isYours = currentAuthor(state) === playerId
      return {
        phase: 'guess',
        prompt: state.prompt,
        turn: state.turn + 1,
        totalTurns: state.order.length,
        answerText: state.answers[currentAuthor(state)],
        isYours,
        candidates: isYours
          ? []
          : state.players
              .filter((p) => p.id !== playerId)
              .map(({ id, nickname }) => ({ id, nickname })),
        yourGuess: currentGuesses(state)[playerId] ?? null,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      const author = state.players.find((p) => p.id === currentAuthor(state))
      return {
        phase: 'reveal',
        prompt: state.prompt,
        turn: state.turn + 1,
        totalTurns: state.order.length,
        answerText: state.answers[currentAuthor(state)],
        authorNickname: author?.nickname ?? '?',
        correctGuessers: state.players
          .filter((p) => currentGuesses(state)[p.id] === currentAuthor(state))
          .map((p) => p.nickname),
        leaderboard: leaderboard(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  hostView(state): WstHostView {
    if (state.phase === 'answer') {
      return {
        phase: 'answer',
        prompt: state.prompt,
        answeredCount: Object.keys(state.answers).length,
        totalPlayers: active(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'guess') {
      return {
        phase: 'guess',
        prompt: state.prompt,
        turn: state.turn + 1,
        totalTurns: state.order.length,
        answerText: state.answers[currentAuthor(state)],
        guessedCount: Object.keys(currentGuesses(state)).length,
        totalGuessers: eligibleGuessers(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      const author = state.players.find((p) => p.id === currentAuthor(state))
      return {
        phase: 'reveal',
        prompt: state.prompt,
        turn: state.turn + 1,
        totalTurns: state.order.length,
        answerText: state.answers[currentAuthor(state)],
        authorNickname: author?.nickname ?? '?',
        correctGuessers: state.players
          .filter((p) => currentGuesses(state)[p.id] === currentAuthor(state))
          .map((p) => p.nickname),
        leaderboard: leaderboard(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  isFinished: (state) => state.phase === 'finished',
}
