import { expect, test } from '@playwright/test'

test('host + three players play a Most Likely To round', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage()
  await host.goto('/host')
  const code = await host.getByTestId('room-code').innerText()

  const players = []
  for (const name of ['Ana', 'Ben', 'Cy']) {
    const page = await (await browser.newContext()).newPage()
    await page.goto('/join')
    await page.getByPlaceholder('ROOM CODE').fill(code)
    await page.getByPlaceholder('Your nickname').fill(name)
    await page.getByRole('button', { name: 'Join' }).click()
    players.push(page)
  }
  // exact:true so "Cy" doesn't collide with the "spicy 🔞" tone-picker button.
  for (const name of ['Ana', 'Ben', 'Cy']) {
    await expect(host.getByText(name, { exact: true })).toBeVisible()
  }

  await host.getByRole('button', { name: 'Most Likely To', exact: true }).click()
  await host.getByRole('button', { name: 'Start Most Likely To' }).click()

  await expect(host.getByText(/Who is most likely to/)).toBeVisible()

  // Each player taps the first candidate button they see (self is excluded).
  for (const page of players) {
    await expect(page.getByText(/Who is most likely to/)).toBeVisible()
    await page.locator('main button:not([disabled])').first().click()
  }

  // All three voted → host reveal shows the tally with a Next button.
  await expect(host.getByRole('button', { name: 'Next', exact: true })).toBeVisible()
})
