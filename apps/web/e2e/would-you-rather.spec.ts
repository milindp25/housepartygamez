import { expect, test } from '@playwright/test'

test('host + two players play a full WYR round', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage()
  await host.goto('/host')
  const code = await host.getByTestId('room-code').innerText()

  const players = []
  for (const name of ['Ana', 'Ben']) {
    const page = await (await browser.newContext()).newPage()
    await page.goto('/join')
    await page.getByPlaceholder('ROOM CODE').fill(code)
    await page.getByPlaceholder('Your nickname').fill(name)
    await page.getByRole('button', { name: 'Join' }).click()
    players.push(page)
  }
  await expect(host.getByText('Ana')).toBeVisible()
  await expect(host.getByText('Ben')).toBeVisible()

  await host.getByRole('button', { name: 'Start Would You Rather' }).click()
  await expect(host.getByText('Would you rather…')).toBeVisible()

  for (const page of players) {
    await expect(page.getByText('Would you rather…')).toBeVisible()
    await page.locator('button:not([disabled])').first().click()
  }
  // Both voted → reveal shows on the TV with a Next button. `exact` avoids
  // colliding with Next.js 16's dev-tools overlay ("Open Next.js Dev Tools").
  await expect(host.getByRole('button', { name: 'Next', exact: true })).toBeVisible()
})
