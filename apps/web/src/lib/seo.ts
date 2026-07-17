import { MARKETING_GAMES, type MarketingGame } from './games'

/** Product name, used in metadata, JSON-LD, and the OG image. */
export const SITE_NAME = 'HousePartyGamez'

/** One-line product description reused across metadata surfaces. */
export const SITE_TAGLINE = 'Party games everyone plays on their phones'

/** Absolute deployed origin, normalized without a trailing slash. */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://housepartygamez.com'
).replace(/\/$/, '')

/** Fixed marketing-content date used for deterministic sitemap entries. */
export const LAST_MODIFIED = '2026-07-17'

/** Return the generated social card's absolute URL. */
export function socialImageUrl(): string {
  return `${SITE_URL}/opengraph-image`
}

/** One indexable marketing route consumed by the generated sitemap. */
export interface MarketingRoute {
  path: string
  priority: number
  changeFrequency: 'yearly' | 'monthly' | 'weekly'
}

/** Return the landing page and every public game guide. */
export function marketingRoutes(): MarketingRoute[] {
  return [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    ...MARKETING_GAMES.map((game) => ({
      path: `/games/${game.slug}`,
      priority: 0.8,
      changeFrequency: 'monthly' as const,
    })),
  ]
}

/** Build schema.org Game structured data for one public guide. */
export function gameJsonLd(game: MarketingGame): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Game',
    name: game.name,
    description: game.description,
    url: `${SITE_URL}/games/${game.slug}`,
    numberOfPlayers: {
      '@type': 'QuantitativeValue',
      minValue: game.minPlayers,
      maxValue: game.maxPlayers,
    },
    genre: 'Party game',
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  }
}

/** Build schema.org WebSite structured data for the landing page. */
export function homeJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: SITE_TAGLINE,
    url: SITE_URL,
  }
}
