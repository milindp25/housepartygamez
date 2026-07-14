import { describe, expect, it } from 'vitest'
import type { GamePlayer } from '../engine/types'
import type { WstState } from './whoSaidThat'
import { whoSaidThat } from './whoSaidThat'

const players: GamePlayer[] = [
  { id: 'p1', nickname: 'Ana', connected: true },
  { id: 'p2', nickname: 'Ben', connected: true },
  { id: 'p3', nickname: 'Cy', connected: true },
]
const prompts = [{ id: 'q1', text: 'strangest thing you believed as a child' }]
const settings = { answerSeconds: 60, guessSeconds: 30, revealSeconds: 10 }
const T0 = 1_000_000

function fresh(): WstState {
  return whoSaidThat.init({ players, prompts, settings, now: T0 })
}
function submit(s: WstState, playerId: string, text: string): WstState {
  return whoSaidThat.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { text }, now: T0 })
}
function guess(s: WstState, playerId: string, authorId: string): WstState {
  return whoSaidThat.reducer(s, {
    type: 'PLAYER_INPUT',
    playerId,
    input: { authorId },
    now: T0,
  })
}
function allSubmit(s: WstState): WstState {
  s = submit(s, 'p1', 'Clouds were solid')
  s = submit(s, 'p2', 'TV people lived in the TV')
  return submit(s, 'p3', 'The moon followed our car')
}

describe('who-said-that', () => {
  it('collects answers, rejecting blank and over-140-char text', () => {
    let s = submit(fresh(), 'p1', '   ')
    expect(s.answers).toEqual({})
    s = submit(s, 'p1', 'x'.repeat(141))
    expect(s.answers).toEqual({})
    s = submit(s, 'p1', 'Clouds were solid')
    expect(s.answers.p1).toBe('Clouds were solid')
    expect(s.phase).toBe('answer')
  })

  it('moves to guessing once everyone answered, with a deterministic order', () => {
    const a = allSubmit(fresh())
    const b = allSubmit(fresh())
    expect(a.phase).toBe('guess')
    expect(a.order).toHaveLength(3)
    expect(a.order).toEqual(b.order)
  })

  it("the current answer's author cannot guess; others cannot guess themselves", () => {
    const s = allSubmit(fresh())
    const author = s.order[0]
    expect(guess(s, author, 'p1')).toEqual(s)
    const guesser = players.find((p) => p.id !== author)!.id
    expect(guess(s, guesser, guesser)).toEqual(s)
  })

  it('reveals when all eligible guessed; correct guessers +1, author +1 per wrong guess', () => {
    let s = allSubmit(fresh())
    const author = s.order[0]
    const others = players.filter((p) => p.id !== author).map((p) => p.id)
    s = guess(s, others[0], author)
    s = guess(s, others[1], others[0])
    expect(s.phase).toBe('reveal')
    expect(s.scores[others[0]]).toBe(1)
    expect(s.scores[author]).toBe(1)
  })

  it('walks every answer then finishes', () => {
    let s = allSubmit(fresh())
    for (let turn = 0; turn < 3; turn++) {
      const author = s.order[turn]
      for (const p of players.filter((x) => x.id !== author)) s = guess(s, p.id, author)
      s = whoSaidThat.reducer(s, { type: 'HOST_ADVANCE', now: T0 + turn * 1000 })
    }
    expect(whoSaidThat.isFinished(s)).toBe(true)
  })

  it('answer-phase timeout drops non-submitters; fewer than 2 answers finishes the game', () => {
    let s = submit(fresh(), 'p1', 'Only me')
    s = whoSaidThat.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 60_000 })
    expect(s.phase).toBe('finished')
  })

  it("playerView marks the author's own answer without leaking it to others", () => {
    const s = allSubmit(fresh())
    const author = s.order[0]
    const authorView = whoSaidThat.playerView(s, author) as { isYours: boolean }
    const otherView = whoSaidThat.playerView(s, players.find((p) => p.id !== author)!.id) as {
      isYours: boolean
      candidates: Array<{ id: string }>
    }
    expect(authorView.isYours).toBe(true)
    expect(otherView.isYours).toBe(false)
    expect(otherView.candidates.length).toBe(2)
  })
})
