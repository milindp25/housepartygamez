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
  await expect(page.getByRole('link', { name: 'Host Bluff Battle' })).toHaveAttribute(
    'href',
    '/host?game=bluff-battle',
  )

  const description = await page.locator('meta[name="description"]').getAttribute('content')
  expect(description?.length).toBeGreaterThanOrEqual(120)
  expect(description?.length).toBeLessThanOrEqual(160)
})

test('the game-card arrow follows the stretched game link', async ({ page }) => {
  await page.goto('/')

  const arrow = page.locator('.game-card').filter({ hasText: 'Bluff Battle' }).locator('.card-arrow')
  await arrow.scrollIntoViewIfNeeded()
  const bounds = await arrow.boundingBox()
  expect(bounds).not.toBeNull()
  await page.mouse.click(bounds!.x + bounds!.width / 2, bounds!.y + bounds!.height / 2)

  await expect(page).toHaveURL('/games/bluff-battle')
})

test('the landing page does not overflow a 320px viewport', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 })
  await page.goto('/')

  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(widths.document).toBeLessThanOrEqual(widths.viewport)
})

test('the host accepts only known game deep links', async ({ browser }) => {
  for (const [query, selectedGame] of [
    ['?game=bluff-battle', 'Bluff Battle'],
    ['?game=not-a-game', 'Would You Rather'],
  ] as const) {
    const hostContext = await browser.newContext()
    const playerContext = await browser.newContext()
    const host = await hostContext.newPage()
    const player = await playerContext.newPage()

    await host.goto(`/host${query}`)
    const code = await host.getByTestId('room-code').innerText()
    await player.goto('/join')
    await player.getByPlaceholder('ROOM CODE').fill(code)
    await player.getByPlaceholder('Your nickname').fill('Ana')
    await player.getByRole('button', { name: 'Join' }).click()

    await expect(host.getByRole('button', { name: `Start ${selectedGame}` })).toBeVisible()
    await hostContext.close()
    await playerContext.close()
  }
})
