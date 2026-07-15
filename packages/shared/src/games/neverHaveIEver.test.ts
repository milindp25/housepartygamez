import { describe, expect, it } from 'vitest'
import type { GamePlayer } from '../engine/types'
import type { NhieState } from './neverHaveIEver'
import { neverHaveIEver } from './neverHaveIEver'

const players: GamePlayer[] = [
  { id: 'p1', nickname: 'Ana', connected: true },
  { id: 'p2', nickname: 'Ben', connected: true },
  { id: 'p3', nickname: 'Cy', connected: true },
]
const prompts = [
  { id: 'q1', text: 'missed a flight' },
  { id: 'q2', text: 'sung karaoke' },
  { id: 'q3', text: 'broken a bone' },
]
const base = {
  rounds: 3,
  answerSeconds: 20,
  revealSeconds: 8,
  revealMode: 'names' as 'names' | 'count',
  elimination: false,
  strikes: 2,
}
const T0 = 1_000_000

function fresh(settings = base): NhieState {
  return neverHaveIEver.init({ players, prompts, settings, now: T0 })
}
function answer(s: NhieState, playerId: string, done: boolean): NhieState {
  return neverHaveIEver.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { done }, now: T0 })
}
function allAnswer(s: NhieState, map: Record<string, boolean>): NhieState {
  for (const [id, done] of Object.entries(map)) s = answer(s, id, done)
  return s
}

describe('never-have-i-ever', () => {
  it('reveals once everyone answered, tracking strikes for "I have"', () => {
    const s = allAnswer(fresh(), { p1: true, p2: false, p3: true })
    expect(s.phase).toBe('reveal')
    expect(s.strikes).toEqual({ p1: 1, p2: 0, p3: 1 })
  })

  it('names mode exposes who said yes; count mode only exposes the number', () => {
    const named = allAnswer(fresh(), { p1: true, p2: false, p3: false })
    const nView = neverHaveIEver.playerView(named, 'p2') as {
      yesNames?: string[]
      yesCount: number
    }
    expect(nView.yesNames).toEqual(['Ana'])

    const counted = allAnswer(fresh({ ...base, revealMode: 'count' }), {
      p1: true,
      p2: false,
      p3: false,
    })
    const cView = neverHaveIEver.playerView(counted, 'p2') as {
      yesNames?: string[]
      yesCount: number
    }
    expect(cView.yesCount).toBe(1)
    expect(cView.yesNames).toBeUndefined()
  })

  it('elimination mode ends early when one player remains', () => {
    let s = fresh({ ...base, elimination: true, strikes: 1 })
    s = allAnswer(s, { p1: true, p2: true, p3: false })
    s = neverHaveIEver.reducer(s, { type: 'HOST_ADVANCE', now: T0 + 5000 })
    expect(s.phase).toBe('finished')
  })

  it('eliminated players cannot answer and are not waited on', () => {
    let s = fresh({ ...base, elimination: true, strikes: 1, rounds: 3 })
    s = allAnswer(s, { p1: true, p2: false, p3: false })
    s = neverHaveIEver.reducer(s, { type: 'HOST_ADVANCE', now: T0 + 5000 })
    expect(s.phase).toBe('answer')
    s = allAnswer(s, { p2: false, p3: false })
    expect(s.phase).toBe('reveal')
    expect(answer(s, 'p1', false)).toEqual(s)
  })

  it('finishes after all rounds with strikes as the leaderboard (fewest first)', () => {
    let s = fresh({ ...base, rounds: 1 })
    s = allAnswer(s, { p1: true, p2: false, p3: true })
    s = neverHaveIEver.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 9000 })
    expect(s.phase).toBe('finished')
    const view = neverHaveIEver.hostView(s) as { leaderboard: Array<{ playerId: string }> }
    expect(view.leaderboard[0].playerId).toBe('p2')
  })
})
