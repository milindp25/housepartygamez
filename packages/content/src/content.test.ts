import type { ContentPack } from '@hpg/shared'
import { describe, expect, it } from 'vitest'
import { bluffFamily, bluffFriends, bluffSpicy } from './bluffBattle'
import { impFamily, impFriends, impSpicy } from './imposter'
import { mltFamily, mltFriends, mltSpicy } from './mostLikelyTo'
import { nhieFamily, nhieFriends, nhieSpicy } from './neverHaveIEver'
import { wstFamily, wstFriends, wstSpicy } from './whoSaidThat'
import { wyrFamily, wyrFriends, wyrSpicy } from './wouldYouRather'

const packs = [
  wyrFamily,
  wyrFriends,
  wyrSpicy,
  mltFamily,
  mltFriends,
  mltSpicy,
  nhieFamily,
  nhieFriends,
  nhieSpicy,
  wstFamily,
  wstFriends,
  wstSpicy,
  impFamily,
  impFriends,
  impSpicy,
  bluffFamily,
  bluffFriends,
  bluffSpicy,
] as const satisfies readonly ContentPack<unknown>[]

function promptFingerprint(prompt: unknown): string {
  const { id: _id, ...content } = prompt as Record<string, unknown>
  return JSON.stringify(content)
    .toLocaleLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '')
}

describe('built-in content packs', () => {
  it('contains 100 unique, nonempty prompts in every game and tone', () => {
    const allIds = new Set<string>()
    const fingerprintsByGame = new Map<string, Set<string>>()

    for (const pack of packs) {
      expect(pack.prompts, pack.id).toHaveLength(100)
      const fingerprints = fingerprintsByGame.get(pack.game) ?? new Set<string>()
      fingerprintsByGame.set(pack.game, fingerprints)
      const promptNumbers: number[] = []

      for (const prompt of pack.prompts) {
        const values = Object.entries(prompt as unknown as Record<string, unknown>)
        const id = String((prompt as { id: unknown }).id)
        expect(id, pack.id).toMatch(/^[a-z]+-(fam|fri|spi)-\d+$/)
        expect(allIds.has(id), `duplicate prompt id ${id}`).toBe(false)
        allIds.add(id)
        promptNumbers.push(Number(id.match(/\d+$/)?.[0]))

        for (const [key, value] of values) {
          expect(typeof value, `${id}.${key}`).toBe('string')
          expect(String(value).trim().length, `${id}.${key}`).toBeGreaterThan(0)
        }

        const fingerprint = promptFingerprint(prompt)
        expect(fingerprints.has(fingerprint), `duplicate content in ${pack.id}: ${id}`).toBe(false)
        fingerprints.add(fingerprint)
      }

      expect(promptNumbers, `${pack.id} ids`).toEqual(
        Array.from({ length: 100 }, (_, index) => index + 1),
      )
    }
  })

  it('keeps Would You Rather choices meaningfully distinct', () => {
    for (const pack of [wyrFamily, wyrFriends, wyrSpicy]) {
      for (const prompt of pack.prompts) {
        expect(prompt.a.trim().toLocaleLowerCase(), prompt.id).not.toBe(
          prompt.b.trim().toLocaleLowerCase(),
        )
      }
    }
  })
})
