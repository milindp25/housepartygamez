import type { GameId } from './types'

/**
 * The three tone tiers a content pack targets. `family` = kid-safe, `friends`
 * = general, `spicy` = 18+ (the host confirms the age gate before starting).
 */
export type PackTone = 'family' | 'friends' | 'spicy'

/**
 * A question pack. Built-in packs live in `@hpg/content`; user-authored
 * custom packs (plan 4) share this same shape so both flow through the same
 * `pickPrompts` and are interchangeable at the game boundary.
 */
export interface ContentPack<Prompt> {
  id: string
  game: GameId
  tone: PackTone
  locale: 'en'
  prompts: Prompt[]
}

/**
 * Select `count` random prompts from a pack.
 *
 * Fisher–Yates shuffle then slice, so every prompt has an equal chance and no
 * duplicates appear within a single game. The `random` source is injectable
 * so tests (and any future replay tooling) can produce deterministic
 * sequences — the game reducers themselves are already pure, so this closes
 * the last non-determinism at the content boundary.
 */
export function pickPrompts<P>(
  pack: ContentPack<P>,
  count: number,
  random: () => number = Math.random,
): P[] {
  const pool = [...pack.prompts]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(count, pool.length))
}
