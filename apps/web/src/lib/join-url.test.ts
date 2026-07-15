import { describe, expect, it } from 'vitest'
import { buildJoinUrl } from './join-url'

describe('buildJoinUrl', () => {
  it('normalizes trailing slashes on the origin', () => {
    expect(buildJoinUrl('https://party.example///', 'ABCD')).toBe(
      'https://party.example/join?code=ABCD',
    )
  })

  it('encodes the room code as one query value', () => {
    expect(buildJoinUrl('https://party.example', 'A B&?')).toBe(
      'https://party.example/join?code=A%20B%26%3F',
    )
  })
})
