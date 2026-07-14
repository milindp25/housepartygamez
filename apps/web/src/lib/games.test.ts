import { describe, expect, it } from 'vitest'
import { MARKETING_GAMES, getMarketingGame } from './games'

describe('marketing game registry', () => {
  it('contains seven unique slugs and engine ids with complete content', () => {
    expect(MARKETING_GAMES).toHaveLength(7)
    expect(new Set(MARKETING_GAMES.map((game) => game.slug)).size).toBe(7)
    expect(new Set(MARKETING_GAMES.map((game) => game.id)).size).toBe(7)
    for (const game of MARKETING_GAMES) {
      expect(game.description.split(/\s+/).length).toBeGreaterThanOrEqual(100)
      expect(game.description.split(/\s+/).length).toBeLessThanOrEqual(140)
      expect(game.howTo.length).toBeGreaterThanOrEqual(3)
      expect(game.minPlayers).toBeGreaterThan(0)
      expect(game.maxPlayers).toBeGreaterThanOrEqual(game.minPlayers)
      expect(game.minutes).toBeGreaterThan(0)
    }
  })

  it('looks up known slugs and returns undefined for unknown slugs', () => {
    expect(getMarketingGame('bluff-battle')?.id).toBe('bluff-battle')
    expect(getMarketingGame('not-a-game')).toBeUndefined()
  })
})
