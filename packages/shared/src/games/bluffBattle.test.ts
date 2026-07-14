import { describe, expect, it } from 'vitest'
import type { GamePlayer } from '../engine/types'
import type { BluffState } from './bluffBattle'
import { bluffBattle } from './bluffBattle'

const players: GamePlayer[] = [
  { id: 'p1', nickname: 'Ana', connected: true },
  { id: 'p2', nickname: 'Ben', connected: true },
  { id: 'p3', nickname: 'Cy', connected: true },
]
const prompts = [{ id: 'q1', question: 'A group of flamingos is called a…', answer: 'Flamboyance' }]
const settings = { rounds: 1, bluffSeconds: 45, voteSeconds: 30, revealSeconds: 12 }
const T0 = 1_000_000

function fresh(): BluffState {
  return bluffBattle.init({ players, prompts, settings, now: T0 })
}
function bluff(s: BluffState, playerId: string, text: string): BluffState {
  return bluffBattle.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { text }, now: T0 })
}
function pick(s: BluffState, playerId: string, optionId: string): BluffState {
  return bluffBattle.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { optionId }, now: T0 })
}

describe('bluff-battle', () => {
  it('collects bluffs; rejects blanks, >100 chars, and the real answer', () => {
    let s = bluff(fresh(), 'p1', '  ')
    expect(Object.keys(s.bluffs)).toHaveLength(0)
    s = bluff(s, 'p1', 'x'.repeat(101))
    expect(Object.keys(s.bluffs)).toHaveLength(0)
    s = bluff(s, 'p1', 'flamboyance') // case-insensitive match with truth → rejected
    expect(Object.keys(s.bluffs)).toHaveLength(0)
    s = bluff(s, 'p1', 'A flock')
    expect(s.bluffs.p1).toBe('A flock')
  })

  it('builds vote options once everyone bluffed: truth + deduped bluffs', () => {
    let s = bluff(fresh(), 'p1', 'A flock')
    s = bluff(s, 'p2', 'a flock') // duplicate (case-insensitive) merges with p1's
    s = bluff(s, 'p3', 'A stand')
    expect(s.phase).toBe('vote')
    expect(s.options).toHaveLength(3) // truth, "A flock" (authors p1+p2), "A stand"
    const truth = s.options.find((o) => o.isTruth)!
    expect(truth.text).toBe('Flamboyance')
    const merged = s.options.find((o) => o.text === 'A flock')!
    expect(merged.authorIds.sort()).toEqual(['p1', 'p2'])
  })

  it('vote options order is deterministic for identical inputs', () => {
    const play = () => {
      let s = bluff(fresh(), 'p1', 'A flock')
      s = bluff(s, 'p2', 'A stand')
      s = bluff(s, 'p3', 'A blush')
      return s.options.map((o) => o.id)
    }
    expect(play()).toEqual(play())
  })

  it('players cannot vote for options they authored', () => {
    let s = bluff(fresh(), 'p1', 'A flock')
    s = bluff(s, 'p2', 'A stand')
    s = bluff(s, 'p3', 'A blush')
    const own = s.options.find((o) => o.authorIds.includes('p1'))!
    const before = s
    s = pick(s, 'p1', own.id)
    expect(s).toEqual(before)
  })

  it('scores +2 for truth-finders and +1 per fooled voter to bluff authors', () => {
    let s = bluff(fresh(), 'p1', 'A flock')
    s = bluff(s, 'p2', 'A stand')
    s = bluff(s, 'p3', 'A blush')
    const truth = s.options.find((o) => o.isTruth)!
    const p2Bluff = s.options.find((o) => o.authorIds.includes('p2'))!
    s = pick(s, 'p1', p2Bluff.id) // p1 fooled by p2
    s = pick(s, 'p2', truth.id) // p2 finds truth
    s = pick(s, 'p3', truth.id) // p3 finds truth
    expect(s.phase).toBe('reveal')
    expect(s.scores).toEqual({ p1: 0, p2: 3, p3: 2 }) // p2: +2 truth, +1 fooled p1
  })

  it('timer closes each phase; reveal advance finishes after last round', () => {
    let s = bluff(fresh(), 'p1', 'A flock')
    s = bluffBattle.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 45_000 }) // p2/p3 missed bluffing
    expect(s.phase).toBe('vote')
    s = bluffBattle.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 80_000 })
    expect(s.phase).toBe('reveal')
    s = bluffBattle.reducer(s, { type: 'HOST_ADVANCE', now: T0 + 95_000 })
    expect(bluffBattle.isFinished(s)).toBe(true)
  })

  it('playerView never marks which option is the truth before reveal', () => {
    let s = bluff(fresh(), 'p1', 'A flock')
    s = bluff(s, 'p2', 'A stand')
    s = bluff(s, 'p3', 'A blush')
    const view = bluffBattle.playerView(s, 'p1') as { options: Array<Record<string, unknown>> }
    for (const o of view.options) {
      expect(o).not.toHaveProperty('isTruth')
      expect(o).not.toHaveProperty('authorIds')
    }
  })
})
