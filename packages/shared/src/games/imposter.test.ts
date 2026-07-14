import { describe, expect, it } from 'vitest'
import type { GamePlayer } from '../engine/types'
import type { ImposterState } from './imposter'
import { imposter } from './imposter'

const players: GamePlayer[] = [
  { id: 'p1', nickname: 'Ana', connected: true },
  { id: 'p2', nickname: 'Ben', connected: true },
  { id: 'p3', nickname: 'Cy', connected: true },
  { id: 'p4', nickname: 'Di', connected: true },
]
const prompts = [
  { id: 'w1', word: 'Banana', category: 'Fruit' },
  { id: 'w2', word: 'Guitar', category: 'Instrument' },
]
const settings = {
  rounds: 2,
  hint: 'category' as const,
  clueSeconds: 25,
  voteSeconds: 30,
  revealSeconds: 10,
}
const T0 = 1_000_000

function fresh(): ImposterState {
  return imposter.init({ players, prompts, settings, now: T0 })
}
function ready(s: ImposterState, playerId: string): ImposterState {
  return imposter.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { ready: true }, now: T0 })
}
function vote(s: ImposterState, playerId: string, suspectId: string): ImposterState {
  return imposter.reducer(s, {
    type: 'PLAYER_INPUT',
    playerId,
    input: { suspectId },
    now: T0,
  })
}
function toVotePhase(s: ImposterState): ImposterState {
  for (const p of players) s = ready(s, p.id)
  // clues phase: host advances past each speaker (N advances to open voting).
  for (let i = 0; i < players.length; i++)
    s = imposter.reducer(s, { type: 'HOST_ADVANCE', now: T0 })
  return s
}

describe('imposter', () => {
  it('assigns exactly one imposter deterministically from init time', () => {
    const a = fresh()
    const b = fresh()
    expect(a.imposterId).toBe(b.imposterId)
    expect(players.some((p) => p.id === a.imposterId)).toBe(true)
  })

  it('shows the word to everyone except the imposter, who gets the category hint', () => {
    const s = fresh()
    const civilian = players.find((p) => p.id !== s.imposterId)!.id
    const civView = imposter.playerView(s, civilian) as {
      word?: string
      hint?: string
      isImposter: boolean
    }
    const impView = imposter.playerView(s, s.imposterId) as {
      word?: string
      hint?: string
      isImposter: boolean
    }
    expect(civView).toMatchObject({ isImposter: false, word: s.prompts[0].word })
    expect(civView.hint).toBeUndefined()
    expect(impView.isImposter).toBe(true)
    expect(impView.word).toBeUndefined()
    expect(impView.hint).toBe('Fruit')
  })

  it('moves word -> clues when all ready, walking a full speaking order', () => {
    let s = fresh()
    for (const p of players) s = ready(s, p.id)
    expect(s.phase).toBe('clues')
    expect(s.speakingOrder).toHaveLength(4)
    expect(new Set(s.speakingOrder).size).toBe(4)
    for (let i = 0; i < 3; i++) {
      s = imposter.reducer(s, { type: 'HOST_ADVANCE', now: T0 })
      expect(s.phase).toBe('clues')
    }
    s = imposter.reducer(s, { type: 'HOST_ADVANCE', now: T0 })
    expect(s.phase).toBe('vote')
  })

  it('rejects self-votes', () => {
    const s = toVotePhase(fresh())
    const before = s
    const after = vote(s, 'p1', 'p1')
    expect(after).toEqual(before)
  })

  it('caught imposter: voters who fingered them score; imposter gets nothing', () => {
    let s = toVotePhase(fresh())
    const imp = s.imposterId
    const others = players.filter((p) => p.id !== imp).map((p) => p.id)
    // Strict plurality on imposter: 3 votes on imposter vs max 1 elsewhere.
    s = vote(s, others[0], imp)
    s = vote(s, others[1], imp)
    s = vote(s, others[2], imp)
    s = vote(s, imp, others[0])
    expect(s.phase).toBe('reveal')
    expect(s.scores[others[0]]).toBe(1)
    expect(s.scores[others[1]]).toBe(1)
    expect(s.scores[others[2]]).toBe(1)
    expect(s.scores[imp]).toBe(0)
  })

  it('escaped imposter (tie or not top) earns +2', () => {
    let s = toVotePhase(fresh())
    const imp = s.imposterId
    const others = players.filter((p) => p.id !== imp).map((p) => p.id)
    s = vote(s, others[0], others[1])
    s = vote(s, others[1], others[0])
    s = vote(s, others[2], others[0])
    s = vote(s, imp, others[0])
    expect(s.phase).toBe('reveal')
    expect(s.scores[imp]).toBe(2)
  })

  it('rotates to a new word and (hash-)new imposter next round, then finishes', () => {
    let s = toVotePhase(fresh())
    for (const p of players) if (p.id !== s.imposterId) s = vote(s, p.id, s.imposterId)
    s = vote(s, s.imposterId, players.find((p) => p.id !== s.imposterId)!.id)
    s = imposter.reducer(s, { type: 'HOST_ADVANCE', now: T0 + 60_000 })
    expect(s.phase).toBe('word')
    expect(s.round).toBe(2)
    expect(s.prompts[1].word).toBe('Guitar')
    s = toVotePhase(s)
    for (const p of players) if (p.id !== s.imposterId) s = vote(s, p.id, s.imposterId)
    s = vote(s, s.imposterId, players.find((p) => p.id !== s.imposterId)!.id)
    s = imposter.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 90_000 })
    expect(imposter.isFinished(s)).toBe(true)
  })

  it('hint "none" leaves the imposter with no category', () => {
    const s = imposter.init({ players, prompts, settings: { ...settings, hint: 'none' }, now: T0 })
    const impView = imposter.playerView(s, s.imposterId) as { hint?: string }
    expect(impView.hint).toBeUndefined()
  })
})
