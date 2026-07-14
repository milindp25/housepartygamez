import { describe, expect, it } from 'vitest'
import type { GamePlayer } from '../engine/types'
import type { MltState } from './mostLikelyTo'
import { mostLikelyTo } from './mostLikelyTo'

const players: GamePlayer[] = [
  { id: 'p1', nickname: 'Ana', connected: true },
  { id: 'p2', nickname: 'Ben', connected: true },
  { id: 'p3', nickname: 'Cy', connected: true },
]
const prompts = [{ id: 'q1', text: 'become famous accidentally' }]
const settings = { rounds: 1, voteSeconds: 30, revealSeconds: 8, anonymousVotes: true }
const T0 = 1_000_000

function fresh(): MltState {
  return mostLikelyTo.init({ players, prompts, settings, now: T0 })
}
function vote(s: MltState, playerId: string, targetId: string): MltState {
  return mostLikelyTo.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { targetId }, now: T0 })
}

describe('most-likely-to', () => {
  it('collects votes for players; self-votes and unknown targets are ignored', () => {
    let s = vote(fresh(), 'p1', 'p1')
    expect(s.votes[0]).toEqual({})
    s = vote(s, 'p1', 'ghost')
    expect(s.votes[0]).toEqual({})
    s = vote(s, 'p1', 'p2')
    expect(s.votes[0]).toEqual({ p1: 'p2' })
  })

  it('reveals when all connected players voted and scores votes received', () => {
    let s = vote(fresh(), 'p1', 'p3')
    s = vote(s, 'p2', 'p3')
    s = vote(s, 'p3', 'p1')
    expect(s.phase).toBe('reveal')
    expect(s.scores).toEqual({ p1: 1, p2: 0, p3: 2 })
  })

  it('hides voter identities in views when anonymousVotes is true', () => {
    let s = fresh()
    for (const [voter, target] of [
      ['p1', 'p3'],
      ['p2', 'p3'],
      ['p3', 'p1'],
    ] as const)
      s = vote(s, voter, target)
    const view = mostLikelyTo.playerView(s, 'p1') as {
      phase: string
      tally: Array<{ voters?: string[] }>
    }
    expect(view.phase).toBe('reveal')
    for (const row of view.tally) expect(row.voters).toBeUndefined()
  })

  it('shows voter names when anonymousVotes is false', () => {
    let s = mostLikelyTo.init({
      players,
      prompts,
      settings: { ...settings, anonymousVotes: false },
      now: T0,
    })
    for (const [voter, target] of [
      ['p1', 'p3'],
      ['p2', 'p3'],
      ['p3', 'p1'],
    ] as const)
      s = vote(s, voter, target)
    const view = mostLikelyTo.playerView(s, 'p1') as {
      tally: Array<{ playerId: string; voters?: string[] }>
    }
    expect(view.tally.find((t) => t.playerId === 'p3')?.voters).toEqual(['Ana', 'Ben'])
  })

  it('finishes after the last reveal', () => {
    let s = fresh()
    for (const [voter, target] of [
      ['p1', 'p3'],
      ['p2', 'p3'],
      ['p3', 'p1'],
    ] as const)
      s = vote(s, voter, target)
    s = mostLikelyTo.reducer(s, { type: 'HOST_ADVANCE', now: T0 + 10_000 })
    expect(mostLikelyTo.isFinished(s)).toBe(true)
  })
})
