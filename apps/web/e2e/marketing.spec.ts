import { expect, test, type Locator } from '@playwright/test'

const homeTitle = 'HousePartyGamez — Party games on every phone'
const homeDescription =
  'Host seven social party games on one shared screen while everyone plays from their phone.'

const gameLinks = [
  ['Would You Rather', '/games/would-you-rather'],
  ['Most Likely To', '/games/most-likely-to'],
  ['Never Have I Ever', '/games/never-have-i-ever'],
  ['Who Said That?', '/games/who-said-that'],
  ['Imposter', '/games/imposter'],
  ['Bluff Battle', '/games/bluff-battle'],
  ['Mafia', '/games/mafia'],
] as const

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

async function expectVisibleFocus(locator: Locator): Promise<void> {
  await expect(locator).toBeFocused()
  await expect
    .poll(() =>
      locator.evaluate((element) => {
        const styles = getComputedStyle(element)
        const outlineColorIsTransparent =
          styles.outlineColor === 'transparent' ||
          /^rgba\([^)]*,\s*0(?:\.0+)?\)$/.test(styles.outlineColor)
        const hasVisibleOutline =
          styles.outlineStyle !== 'none' &&
          Number.parseFloat(styles.outlineWidth) > 0 &&
          !outlineColorIsTransparent

        return hasVisibleOutline
      }),
    )
    .toBe(true)
}

test('landing page publishes exact metadata, actions, and all seven games', async ({ page }) => {
  const response = await page.goto('/')
  expect(response?.status()).toBe(200)

  await expect(page).toHaveTitle(homeTitle)
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    'content',
    homeDescription,
  )
  await expect(
    page.getByRole('heading', {
      level: 1,
      name: 'Party games everyone plays on their phones',
    }),
  ).toBeVisible()

  const hero = page.locator('.hero')
  await expect(hero.getByRole('link', { name: 'Host a game' })).toHaveAttribute('href', '/host')
  await expect(hero.getByRole('link', { name: 'Join a room' })).toHaveAttribute('href', '/join')

  for (const [name, href] of gameLinks) {
    const accessibleName = new RegExp(`^${escapeRegExp(name)}`)
    await expect(page.getByRole('link', { name: accessibleName })).toHaveAttribute('href', href)
  }
})

test('every game card resolves to one matching game heading and useful metadata', async ({ page }) => {
  for (const [name, href] of gameLinks) {
    const response = await page.goto(href)
    expect(response?.status()).toBe(200)

    const headings = page.getByRole('heading', { level: 1 })
    await expect(headings).toHaveCount(1)
    await expect(headings).toHaveText(name)

    const description = await page.locator('meta[name="description"]').getAttribute('content')
    expect(description?.length).toBeGreaterThanOrEqual(120)
    expect(description?.length).toBeLessThanOrEqual(160)
  }

  await page.goto('/games/bluff-battle')
  await expect(page).toHaveTitle(
    'Play Bluff Battle Online with Friends | HousePartyGamez',
  )
  await expect(page.getByRole('link', { name: 'Host Bluff Battle' })).toHaveAttribute(
    'href',
    '/host?game=bluff-battle',
  )
})

test('unknown games return a noindex 404', async ({ page }) => {
  const response = await page.goto('/games/not-a-game')

  expect(response?.status()).toBe(404)
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/i)
})

test('keyboard navigation reaches both hero actions with visible focus', async ({ page }) => {
  await page.goto('/')

  const hero = page.locator('.hero')
  const host = hero.getByRole('link', { name: 'Host a game' })
  const join = hero.getByRole('link', { name: 'Join a room' })

  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
  await page.keyboard.press('Tab')
  await expectVisibleFocus(host)
  await page.keyboard.press('Tab')
  await expectVisibleFocus(join)
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

test('reduced motion leaves marquee tiles and hovered cards untransformed', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto('/')

  const card = page.locator('.game-card').first()
  await card.hover()

  await expect
    .poll(() =>
      page.evaluate(() => ({
        card: getComputedStyle(document.querySelector<HTMLElement>('.game-card')!).transform,
        marqueeAllNone: [
          ...document.querySelectorAll<HTMLElement>('.room-code-marquee span'),
        ].every((tile) => getComputedStyle(tile).transform === 'none'),
      })),
    )
    .toEqual({ card: 'none', marqueeAllNone: true })
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
