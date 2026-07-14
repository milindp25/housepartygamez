import { expect, test } from '@playwright/test'

const gameLinks = [
  ['Would You Rather', '/games/would-you-rather'],
  ['Most Likely To', '/games/most-likely-to'],
  ['Never Have I Ever', '/games/never-have-i-ever'],
  ['Who Said That?', '/games/who-said-that'],
  ['Imposter', '/games/imposter'],
  ['Bluff Battle', '/games/bluff-battle'],
  ['Mafia', '/games/mafia'],
] as const

test('landing page introduces every game and opens a game detail page', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Party games everyone plays on their phones',
    }),
  ).toBeVisible()

  for (const [name, href] of gameLinks) {
    await expect(page.getByRole('link', { name: new RegExp(`^${name}`) })).toHaveAttribute(
      'href',
      href,
    )
  }

  await page.getByRole('link', { name: /^Bluff Battle/ }).click()
  await expect(page).toHaveURL('/games/bluff-battle')
  await expect(page.getByRole('heading', { level: 1, name: 'Bluff Battle' })).toBeVisible()
})
