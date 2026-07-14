import { describe, expect, it } from 'vitest'
import { MARKETING_GAMES, getMarketingGame } from './games'

const EXPECTED_GAME_FACTS = [
  {
    slug: 'would-you-rather',
    id: 'would-you-rather',
    minPlayers: 2,
    maxPlayers: 20,
    minutes: 10,
  },
  {
    slug: 'most-likely-to',
    id: 'most-likely-to',
    minPlayers: 3,
    maxPlayers: 20,
    minutes: 15,
  },
  {
    slug: 'never-have-i-ever',
    id: 'never-have-i-ever',
    minPlayers: 3,
    maxPlayers: 20,
    minutes: 15,
  },
  {
    slug: 'who-said-that',
    id: 'who-said-that',
    minPlayers: 3,
    maxPlayers: 20,
    minutes: 20,
  },
  { slug: 'imposter', id: 'imposter', minPlayers: 4, maxPlayers: 20, minutes: 15 },
  {
    slug: 'bluff-battle',
    id: 'bluff-battle',
    minPlayers: 3,
    maxPlayers: 20,
    minutes: 20,
  },
  { slug: 'mafia', id: 'mafia', minPlayers: 6, maxPlayers: 20, minutes: 30 },
] as const

describe('marketing game registry', () => {
  it('contains seven unique slugs and engine ids with complete content', () => {
    expect(MARKETING_GAMES).toHaveLength(7)
    expect(new Set(MARKETING_GAMES.map((game) => game.slug)).size).toBe(7)
    expect(new Set(MARKETING_GAMES.map((game) => game.id)).size).toBe(7)
    expect(
      MARKETING_GAMES.map(({ slug, id, minPlayers, maxPlayers, minutes }) => ({
        slug,
        id,
        minPlayers,
        maxPlayers,
        minutes,
      })),
    ).toEqual(EXPECTED_GAME_FACTS)

    for (const game of MARKETING_GAMES) {
      expect(game.description.split(/\s+/).length).toBeGreaterThanOrEqual(100)
      expect(game.description.split(/\s+/).length).toBeLessThanOrEqual(140)
      expect(game.howTo).toHaveLength(4)
      expect(game.howTo.every((step) => step.trim().length > 0)).toBe(true)
    }
  })

  it('looks up known slugs and returns undefined for unknown slugs', () => {
    for (const { slug, id } of EXPECTED_GAME_FACTS) {
      expect(getMarketingGame(slug)?.id).toBe(id)
    }
    expect(getMarketingGame('not-a-game')).toBeUndefined()
  })
})
