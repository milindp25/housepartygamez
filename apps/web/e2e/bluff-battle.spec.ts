import { expect, test, type Page } from '@playwright/test'

const answersByQuestion: Record<string, string> = {
  'A group of flamingos is called a…': 'A flamboyance',
  'A baby kangaroo is called a…': 'A joey',
  'The only mammal that can truly fly is the…': 'Bat',
  'Bananas grow pointing…': 'Upward',
  'A snail can sleep for up to…': 'Three years',
  'The dot over a lowercase i is called a…': 'Tittle',
  'Octopuses have this many hearts…': 'Three',
  'The Hawaiian pizza was invented in…': 'Canada',
  'A group of pugs is called a…': 'A grumble',
  'Honey never…': 'Spoils',
}

async function join(page: Page, code: string, nickname: string): Promise<void> {
  await page.goto('/join')
  await page.getByPlaceholder('ROOM CODE').fill(code)
  await page.getByPlaceholder('Your nickname').fill(nickname)
  await page.getByRole('button', { name: 'Join' }).click()
}

test('host + three players play a Bluff Battle round without pre-reveal leaks', async ({
  browser,
}) => {
  const host = await (await browser.newContext()).newPage()
  await host.goto('/host')
  const code = await host.getByTestId('room-code').innerText()

  const playerPages: Page[] = []
  const receivedFrames: string[] = []
  for (const name of ['Ana', 'Ben', 'Cy']) {
    const page = await (await browser.newContext()).newPage()
    page.on('websocket', (socket) =>
      socket.on('framereceived', (event) => receivedFrames.push(String(event.payload))),
    )
    await join(page, code, name)
    playerPages.push(page)
  }
  for (const name of ['Ana', 'Ben', 'Cy']) {
    await expect(host.getByText(name, { exact: true })).toBeVisible()
  }

  await host.getByRole('button', { name: 'Bluff Battle', exact: true }).click()
  await host.getByRole('button', { name: 'family', exact: true }).click()
  await host.getByRole('button', { name: 'Start Bluff Battle' }).click()
  await expect(host.getByText(/submitted$/)).toBeVisible()

  await expect(playerPages[0].getByPlaceholder('Your bluff (max 100 chars)')).toBeVisible()
  const question = (await playerPages[0].locator('h2').innerText()).trim()
  const truth = answersByQuestion[question]
  expect(truth).toBeTruthy()
  await playerPages[0].getByPlaceholder('Your bluff (max 100 chars)').fill(truth)
  await playerPages[0].getByRole('button', { name: 'Submit bluff' }).click()
  await expect(playerPages[0].getByText("That's the real answer — too easy! Try another.")).toBeVisible()

  for (const [page, bluff] of playerPages.map((page, index) => [
    page,
    index < 2 ? 'Shared nonsense' : 'Different nonsense',
  ]) as Array<[Page, string]>) {
    await page.getByPlaceholder('Your bluff (max 100 chars)').fill(bluff)
    await page.getByRole('button', { name: 'Submit bluff' }).click()
  }

  for (const page of playerPages) {
    await expect(page.getByText('Pick the real answer')).toBeVisible()
  }
  const voteFrames = receivedFrames.filter((frame) => frame.includes('"phase":"vote"'))
  expect(voteFrames.length).toBeGreaterThan(0)
  expect(voteFrames.join('\n')).not.toMatch(/isTruth|authorIds/)

  const sharedOnAna = playerPages[0].getByRole('button', { name: /Shared nonsense.*yours/ })
  await expect(sharedOnAna).toBeDisabled()
  await playerPages[0].getByRole('button', { name: /Different nonsense/ }).click()
  await playerPages[1].getByRole('button', { name: /Different nonsense/ }).click()
  await playerPages[2].getByRole('button', { name: /Shared nonsense/ }).click()

  await expect(host.getByText(`Real answer: ${truth}`)).toBeVisible()
  await expect(host.getByRole('button', { name: 'Next', exact: true })).toBeVisible()
})
