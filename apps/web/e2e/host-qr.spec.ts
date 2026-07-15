import { expect, test } from '@playwright/test'

test('a newly created host room displays an accessible join QR code', async ({ browser, page }) => {
  await page.goto('/host')

  await expect(page.getByTestId('room-code')).toHaveText(/^[A-Z]{4}$/)
  const code = (await page.getByTestId('room-code').innerText()).trim()
  await expect(page.getByText('Scan with your phone to join')).toBeVisible()

  const qrCode = page.getByRole('img', { name: 'QR code to join this room' })
  await expect(qrCode).toBeVisible()
  await expect(qrCode).toHaveAttribute('width', '160')
  await expect(qrCode).toHaveAttribute('height', '160')

  const joinUrl = `${new URL(page.url()).origin}/join?code=${encodeURIComponent(code)}`
  const joinLink = page.getByRole('link', { name: 'Open join page for this room' })
  await expect(joinLink).toHaveAttribute('href', joinUrl)

  const joinContext = await browser.newContext()
  const joinPage = await joinContext.newPage()
  await joinPage.goto(joinUrl)
  await expect(joinPage.getByPlaceholder('ROOM CODE')).toHaveValue(code)
  await joinContext.close()

  await page.setViewportSize({ width: 320, height: 720 })
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(widths.document).toBeLessThanOrEqual(widths.viewport)
})
