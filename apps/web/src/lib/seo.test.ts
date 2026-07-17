import { describe, expect, it } from 'vitest'
import {
  LAST_MODIFIED,
  SITE_NAME,
  SITE_URL,
  gameJsonLd,
  homeJsonLd,
  marketingRoutes,
  socialImageUrl,
} from './seo'
import { MARKETING_GAMES } from './games'

describe('SEO constants', () => {
  it('exposes an absolute, non-trailing-slash site URL', () => {
    expect(SITE_URL).toMatch(/^https?:\/\/[^/]+$/)
  })

  it('names the product', () => {
    expect(SITE_NAME).toBe('HousePartyGamez')
  })

  it('uses a fixed ISO date for last-modified (not a live clock)', () => {
    expect(LAST_MODIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('exposes an absolute social-image URL', () => {
    expect(socialImageUrl()).toBe(`${SITE_URL}/opengraph-image`)
  })
})

describe('marketingRoutes', () => {
  it('lists the home route plus one per game, excluding app screens', () => {
    const routes = marketingRoutes()
    const paths = routes.map((route) => route.path)
    expect(paths).toContain('/')
    expect(paths).not.toContain('/host')
    expect(paths).not.toContain('/join')
    for (const game of MARKETING_GAMES) {
      expect(paths).toContain(`/games/${game.slug}`)
    }
    expect(routes).toHaveLength(1 + MARKETING_GAMES.length)
  })

  it('gives the home route the highest priority', () => {
    const home = marketingRoutes().find((route) => route.path === '/')!
    const game = marketingRoutes().find((route) => route.path.startsWith('/games/'))!
    expect(home.priority).toBeGreaterThan(game.priority)
  })
})

describe('gameJsonLd', () => {
  it('describes a game with an absolute url and player range', () => {
    const game = MARKETING_GAMES[0]
    const ld = gameJsonLd(game) as {
      '@type': string
      url: string
      numberOfPlayers: { minValue: number; maxValue: number }
    }
    expect(ld['@type']).toBe('Game')
    expect(ld.url).toBe(`${SITE_URL}/games/${game.slug}`)
    expect(ld.numberOfPlayers.minValue).toBe(game.minPlayers)
    expect(ld.numberOfPlayers.maxValue).toBe(game.maxPlayers)
  })
})

describe('homeJsonLd', () => {
  it('describes the site with an absolute url', () => {
    const ld = homeJsonLd() as { '@type': string; url: string }
    expect(ld['@type']).toBe('WebSite')
    expect(ld.url).toBe(SITE_URL)
  })
})
