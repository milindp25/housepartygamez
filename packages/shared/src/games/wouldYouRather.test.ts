import { describe, expect, it } from 'vitest'
import type { GamePlayer } from '../engine/types'
import type { WyrPlayerView, WyrState } from './wouldYouRather'
import { wouldYouRather } from './wouldYouRather'

const players: GamePlayer[] = [
  { id: 'p1', nickname: 'Ana', connected: true },
  { id: 'p2', nickname: 'Ben', connected: true },
  { id: 'p3', nickname: 'Cy', connected: true },
]
const prompts = [
  { id: 'q1', a: 'Fly', b: 'Be invisible' },
  { id: 'q2', a: 'Beach', b: 'Mountains' },
]
const settings = { rounds: 2, voteSeconds: 30, revealSeconds: 8 }
const T0 = 1_000_000

function fresh(): WyrState {
  return wouldYouRather.init({ players, prompts, settings, now: T0 })
}
function vote(s: WyrState, playerId: string, choice: 'a' | 'b', now = T0): WyrState {
  return wouldYouRather.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { choice }, now })
}

describe('would-you-rather', () => {
  it('starts round 1 in vote phase with a deadline', () => {
    const s = fresh()
    expect(s.phase).toBe('vote')
    expect(s.round).toBe(1)
    expect(s.deadline).toBe(T0 + 30_000)
  })

  it('records votes and lets a player change their vote until reveal', () => {
    let s = vote(fresh(), 'p1', 'a')
    s = vote(s, 'p1', 'b')
    expect(s.votes[0].p1).toBe('b')
    expect(s.phase).toBe('vote')
  })

  it('reveals automatically once every connected player voted', () => {
    let s = vote(fresh(), 'p1', 'a')
    s = vote(s, 'p2', 'a')
    s = vote(s, 'p3', 'b', T0 + 5000)
    expect(s.phase).toBe('reveal')
    expect(s.deadline).toBe(T0 + 5000 + 8000)
  })

  it('does not wait for disconnected players', () => {
    const disconnected = [...players]
    disconnected[2] = { ...players[2], connected: false }
    let s = wouldYouRather.init({ players: disconnected, prompts, settings, now: T0 })
    s = vote(s, 'p1', 'a')
    s = vote(s, 'p2', 'b')
    expect(s.phase).toBe('reveal')
  })

  it('awards a point to majority voters, none on a tie', () => {
    let s = vote(fresh(), 'p1', 'a')
    s = vote(s, 'p2', 'a')
    s = vote(s, 'p3', 'b')
    expect(s.scores).toEqual({ p1: 1, p2: 1, p3: 0 })
  })

  it('timer expiry in vote phase reveals with whoever voted', () => {
    let s = vote(fresh(), 'p1', 'a')
    s = wouldYouRather.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 30_000 })
    expect(s.phase).toBe('reveal')
  })

  it('advances rounds and finishes after the last reveal', () => {
    let s = fresh()
    for (const p of ['p1', 'p2', 'p3']) s = vote(s, p, 'a')
    s = wouldYouRather.reducer(s, { type: 'HOST_ADVANCE', now: T0 + 10_000 })
    expect(s.phase).toBe('vote')
    expect(s.round).toBe(2)
    for (const p of ['p1', 'p2', 'p3']) s = vote(s, p, 'b', T0 + 11_000)
    s = wouldYouRather.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 20_000 })
    expect(s.phase).toBe('finished')
    expect(wouldYouRather.isFinished(s)).toBe(true)
  })

  it('rejects input in the wrong phase and from unknown players', () => {
    let s = fresh()
    for (const p of ['p1', 'p2', 'p3']) s = vote(s, p, 'a')
    const inReveal = vote(s, 'p1', 'b')
    expect(inReveal).toEqual(s)
    expect(vote(fresh(), 'ghost', 'a')).toEqual(fresh())
  })

  it('playerView hides other votes during vote phase, shows counts at reveal', () => {
    let s = vote(fresh(), 'p1', 'a')
    const viewP2 = wouldYouRather.playerView(s, 'p2') as WyrPlayerView
    expect(viewP2).toEqual({
      phase: 'vote',
      round: 1,
      totalRounds: 2,
      prompt: prompts[0],
      yourChoice: null,
      deadline: T0 + 30_000,
    })
    s = vote(s, 'p2', 'a')
    s = vote(s, 'p3', 'b')
    const reveal = wouldYouRather.playerView(s, 'p3') as WyrPlayerView
    expect(reveal).toMatchObject({
      phase: 'reveal',
      counts: { a: 2, b: 1 },
      majority: 'a',
      yourChoice: 'b',
    })
  })
})
