import { describe, expect, it } from 'vitest'
import type { ContentPack } from './content'
import { pickPrompts } from './content'

const pack: ContentPack<{ id: string }> = {
  id: 'test',
  game: 'would-you-rather',
  tone: 'friends',
  locale: 'en',
  prompts: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }],
}

describe('pickPrompts', () => {
  it('returns the requested count without duplicates', () => {
    const picked = pickPrompts(pack, 3, () => 0.5)
    expect(picked).toHaveLength(3)
    expect(new Set(picked.map((p) => p.id)).size).toBe(3)
  })

  it('caps at pack size when asking for more than available', () => {
    expect(pickPrompts(pack, 10, () => 0.5)).toHaveLength(4)
  })

  it('is deterministic given an injected RNG', () => {
    const a = pickPrompts(pack, 4, () => 0.1)
    const b = pickPrompts(pack, 4, () => 0.1)
    expect(a).toEqual(b)
  })
})
