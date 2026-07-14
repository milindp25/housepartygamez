import type { ContentPack, GameId, PackTone } from '@hpg/shared'
import { wyrFamily, wyrFriends, wyrSpicy } from './wouldYouRather'
import { mltFamily, mltFriends, mltSpicy } from './mostLikelyTo'
import { nhieFamily, nhieFriends, nhieSpicy } from './neverHaveIEver'

export * from './wouldYouRather'
export * from './mostLikelyTo'
export * from './neverHaveIEver'

/**
 * Registry of built-in packs. Plans 3+ add the other games alongside
 * would-you-rather; kept as a nested map so gaps (missing tone for a new
 * game) are typed as `undefined` and forced to be handled at the call site.
 */
const registry: Partial<Record<GameId, Partial<Record<PackTone, ContentPack<unknown>>>>> = {
  'would-you-rather': { family: wyrFamily, friends: wyrFriends, spicy: wyrSpicy },
  'most-likely-to': { family: mltFamily, friends: mltFriends, spicy: mltSpicy },
  'never-have-i-ever': { family: nhieFamily, friends: nhieFriends, spicy: nhieSpicy },
}

/**
 * Look up a built-in pack. Returns `undefined` when the game/tone combination
 * doesn't exist yet — the server treats that as "unknown game or pack" and
 * rejects the start with a client-facing error rather than throwing.
 */
export function getPack(game: GameId, tone: PackTone): ContentPack<unknown> | undefined {
  return registry[game]?.[tone]
}
