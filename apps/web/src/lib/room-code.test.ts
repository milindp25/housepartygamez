import { describe, expect, it } from 'vitest'
import { normalizeRoomCode } from './room-code'

describe('normalizeRoomCode', () => {
  it('uppercases lowercase input', () => {
    expect(normalizeRoomCode('part')).toBe('PART')
  })
  it('strips non-letters (paste of a messy code)', () => {
    expect(normalizeRoomCode(' pa-rt! ')).toBe('PART')
  })
  it('caps at four characters', () => {
    expect(normalizeRoomCode('PARTYTIME')).toBe('PART')
  })
  it('passes through partial and empty input', () => {
    expect(normalizeRoomCode('PA')).toBe('PA')
    expect(normalizeRoomCode('')).toBe('')
  })
})
