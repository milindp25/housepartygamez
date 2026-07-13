import { describe, expect, it } from 'vitest'
import { ROOM_CODE_ALPHABET, generateRoomCode } from './roomCode'

describe('generateRoomCode', () => {
  it('generates 4 characters from the safe alphabet', () => {
    const code = generateRoomCode()
    expect(code).toHaveLength(4)
    for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch)
  })

  it('excludes ambiguous characters O, I, 0, 1', () => {
    for (const ch of ['O', 'I', '0', '1']) expect(ROOM_CODE_ALPHABET).not.toContain(ch)
  })

  it('is deterministic given an injected RNG', () => {
    const rng = () => 0 // always first letter
    expect(generateRoomCode(rng)).toBe('AAAA')
  })
})
