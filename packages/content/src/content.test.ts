import type { ContentPack, GameId, PackTone } from '@hpg/shared'
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

const gameIdPrefixes: Partial<Record<GameId, string>> = {
  'would-you-rather': 'wyr',
  'most-likely-to': 'mlt',
  'never-have-i-ever': 'nhie',
  'who-said-that': 'wst',
  imposter: 'imp',
  'bluff-battle': 'blf',
}

const toneIdPrefixes: Record<PackTone, string> = { family: 'fam', friends: 'fri', spicy: 'spi' }

function promptFingerprint(prompt: unknown): string {
  const content = Object.fromEntries(
    Object.entries(prompt as Record<string, unknown>).filter(([key]) => key !== 'id'),
  )
  return JSON.stringify(content)
    .toLocaleLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '')
}

function normalizedText(value: string): string {
  return value.toLocaleLowerCase().replaceAll(/[^a-z0-9]+/g, '')
}

describe('built-in content packs', () => {
  it('contains 100 unique, nonempty prompts in every game and tone', () => {
    const allIds = new Set<string>()
    const fingerprintsByGame = new Map<string, Set<string>>()

    for (const pack of packs) {
      expect(pack.prompts.length, pack.id).toBeGreaterThanOrEqual(100)
      const fingerprints = fingerprintsByGame.get(pack.game) ?? new Set<string>()
      fingerprintsByGame.set(pack.game, fingerprints)
      const gameIdPrefix = gameIdPrefixes[pack.game]
      expect(gameIdPrefix, `${pack.id} game prefix`).toBeDefined()
      const idPrefix = `${gameIdPrefix}-${toneIdPrefixes[pack.tone]}-`

      for (const [index, prompt] of pack.prompts.entries()) {
        const values = Object.entries(prompt as unknown as Record<string, unknown>)
        const id = String((prompt as { id: unknown }).id)
        expect(id, pack.id).toMatch(/^[a-z]+-(fam|fri|spi)-\d+$/)
        expect(id, `${pack.id} id at index ${index}`).toBe(`${idPrefix}${index + 1}`)
        expect(allIds.has(id), `duplicate prompt id ${id}`).toBe(false)
        allIds.add(id)

        for (const [key, value] of values) {
          expect(typeof value, `${id}.${key}`).toBe('string')
          expect(String(value).trim().length, `${id}.${key}`).toBeGreaterThan(0)
        }

        const fingerprint = promptFingerprint(prompt)
        expect(fingerprints.has(fingerprint), `duplicate content in ${pack.id}: ${id}`).toBe(false)
        fingerprints.add(fingerprint)
      }
    }
  })

  it('keeps Would You Rather choices meaningfully distinct', () => {
    const pairs = new Set<string>()

    for (const pack of [wyrFamily, wyrFriends, wyrSpicy]) {
      for (const prompt of pack.prompts) {
        const choices = [prompt.a, prompt.b].map(normalizedText)
        expect(choices[0], prompt.id).not.toBe(choices[1])

        const pair = choices.sort().join('|')
        expect(pairs.has(pair), `duplicate or swapped dilemma: ${prompt.id}`).toBe(false)
        pairs.add(pair)
      }
    }
  })

  it('keeps Imposter words and Bluff Battle facts unique across tones', () => {
    const imposterWords = [impFamily, impFriends, impSpicy].flatMap((pack) =>
      pack.prompts.map((prompt) => normalizedText(prompt.word)),
    )
    const bluffQuestions = [bluffFamily, bluffFriends, bluffSpicy].flatMap((pack) =>
      pack.prompts.map((prompt) => normalizedText(prompt.question)),
    )
    const bluffAnswers = [bluffFamily, bluffFriends, bluffSpicy].flatMap((pack) =>
      pack.prompts.map((prompt) => normalizedText(prompt.answer)),
    )

    expect(new Set(imposterWords).size).toBe(imposterWords.length)
    expect(new Set(bluffQuestions).size).toBe(bluffQuestions.length)
    expect(new Set(bluffAnswers).size).toBe(bluffAnswers.length)
  })
})
