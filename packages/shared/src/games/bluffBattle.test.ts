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
function connected(s: BluffState, playerId: string, value: boolean): BluffState {
  return bluffBattle.reducer(s, {
    type: 'PLAYER_CONNECTION_CHANGED',
    playerId,
    connected: value,
    now: T0,
  })
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

  it('locks the first bluff and does not expose truth-match reasons after submission', () => {
    const accepted = bluff(fresh(), 'p1', 'A flock')
    expect(bluff(accepted, 'p1', 'A stand')).toBe(accepted)
    expect(bluff(accepted, 'p1', 'Flamboyance')).toBe(accepted)
    expect(accepted.bluffs.p1).toBe('A flock')
    expect(bluffBattle.inputRejection?.(accepted, 'p1', { text: 'Flamboyance' })).toBeUndefined()
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

  it('uses uniform opaque option IDs that do not disclose the truth before reveal', () => {
    let s = bluff(fresh(), 'p1', 'A flock')
    s = bluff(s, 'p2', 'A stand')
    s = bluff(s, 'p3', 'A blush')
    const view = bluffBattle.playerView(s, 'p1') as { options: Array<{ id: string }> }

    expect(view.options.map((o) => o.id)).toEqual(
      expect.arrayContaining(s.options.map((o) => o.id)),
    )
    for (const option of view.options) expect(option.id).toMatch(/^opt-\d+$/)
  })

  it('assigns unique IDs when distinct normalized bluffs have colliding hashes', () => {
    let s = bluff(fresh(), 'p1', 'an')
    s = bluff(s, 'p2', 'c0') // same length and hash as "an" under the shuffle hash
    s = bluff(s, 'p3', 'A blush')

    expect(s.options.map((o) => o.text)).toEqual(
      expect.arrayContaining(['Flamboyance', 'an', 'c0', 'A blush']),
    )
    expect(new Set(s.options.map((o) => o.id)).size).toBe(s.options.length)
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

  it('locks the first accepted vote', () => {
    let s = bluff(fresh(), 'p1', 'A flock')
    s = bluff(s, 'p2', 'A stand')
    s = bluff(s, 'p3', 'A blush')
    const first = s.options.find((option) => !option.authorIds.includes('p1'))!
    const second = s.options.find(
      (option) => option.id !== first.id && !option.authorIds.includes('p1'),
    )!
    const accepted = pick(s, 'p1', first.id)
    expect(pick(accepted, 'p1', second.id)).toBe(accepted)
    expect(accepted.picks.p1).toBe(first.id)
  })

  it('uses live connections for bluff completion and counters while preserving submissions', () => {
    let s = bluff(fresh(), 'p1', 'A flock')
    s = connected(s, 'p3', false)
    expect(bluffBattle.hostView(s)).toMatchObject({
      phase: 'bluff',
      submittedCount: 1,
      totalPlayers: 2,
    })
    s = connected(s, 'p3', true)
    expect(bluffBattle.hostView(s)).toMatchObject({
      phase: 'bluff',
      submittedCount: 1,
      totalPlayers: 3,
    })
    s = bluff(s, 'p2', 'A stand')
    s = connected(s, 'p3', false)
    expect(s.phase).toBe('vote')
    expect(s.bluffs.p1).toBe('A flock')
  })

  it('does not require a disconnected player to finish voting', () => {
    let s = bluff(fresh(), 'p1', 'A flock')
    s = bluff(s, 'p2', 'A stand')
    s = bluff(s, 'p3', 'A blush')
    const pickable = (playerId: string) =>
      s.options.find((option) => !option.authorIds.includes(playerId))!.id
    s = pick(s, 'p1', pickable('p1'))
    s = pick(s, 'p2', pickable('p2'))
    s = connected(s, 'p3', false)
    expect(s.phase).toBe('reveal')
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
