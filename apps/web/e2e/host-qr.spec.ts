import { expect, test } from '@playwright/test'

test('a newly created host room displays an accessible join QR code', async ({ page }) => {
  await page.goto('/host')

  await expect(page.getByTestId('room-code')).toHaveText(/^[A-Z]{4}$/)
  await expect(page.getByText('Scan with your phone to join')).toBeVisible()

  const qrCode = page.getByRole('img', { name: 'QR code to join this room' })
  await expect(qrCode).toBeVisible()
  await expect(qrCode).toHaveAttribute('width', '160')
  await expect(qrCode).toHaveAttribute('height', '160')
  await expect(qrCode.locator('path').first()).toHaveAttribute('fill', '#0f172a')
  await expect(qrCode.locator('path').nth(1)).toHaveAttribute('fill', '#ffffff')

  await page.setViewportSize({ width: 320, height: 720 })
  const widths = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }))
  expect(widths.document).toBeLessThanOrEqual(widths.viewport)
})
