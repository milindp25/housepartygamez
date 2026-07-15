import { expect, test, type Page } from '@playwright/test'
import { io } from 'socket.io-client'
import type { RoomStateMsg } from '@hpg/shared'
import { bluffFamily } from '@hpg/content'

type CapturedState = { recipient: 'host' | 'player'; message: RoomStateMsg }

const answersByQuestion = Object.fromEntries(
  bluffFamily.prompts.map(({ question, answer }) => [question, answer]),
)

async function join(page: Page, code: string, nickname: string): Promise<void> {
  await page.goto('/join')
  await page.getByPlaceholder('ROOM CODE').fill(code)
  await page.getByPlaceholder('Your nickname').fill(nickname)
  await page.getByRole('button', { name: 'Join' }).click()
}

function captureRoomStates(
  page: Page,
  recipient: CapturedState['recipient'],
  captured: CapturedState[],
): void {
  page.on('websocket', (socket) =>
    socket.on('framereceived', (event) => {
      const payload = String(event.payload)
      if (!payload.startsWith('42')) return
      try {
        const [eventName, message] = JSON.parse(payload.slice(2)) as [string, RoomStateMsg]
        if (eventName === 'room:state') captured.push({ recipient, message })
      } catch {
        // Engine heartbeats and acknowledgements are not room-state frames.
      }
    }),
  )
}

function expectExactKeys(value: unknown, keys: string[]): void {
  expect(Object.keys(value as Record<string, unknown>).sort()).toEqual([...keys].sort())
}

function expectPreRevealAllowlists(captured: CapturedState[]): void {
  const frames = captured.filter(
    ({ message }) =>
      message.game?.id === 'bluff-battle' &&
      ['bluff', 'vote'].includes((message.game.view as { phase: string }).phase),
  )
  for (const phase of ['bluff', 'vote']) {
    expect(
      frames.some(
        ({ recipient, message }) =>
          recipient === 'host' && (message.game?.view as { phase: string }).phase === phase,
      ),
    ).toBe(true)
    expect(
      frames.some(
        ({ recipient, message }) =>
          recipient === 'player' && (message.game?.view as { phase: string }).phase === phase,
      ),
    ).toBe(true)
  }

  for (const { recipient, message } of frames) {
    expectExactKeys(message, ['code', 'phase', 'players', 'game'])
    expectExactKeys(message.game, ['id', 'view'])
    for (const player of message.players) expectExactKeys(player, ['id', 'nickname', 'connected'])
    const view = message.game?.view as Record<string, unknown>
    if (view.phase === 'bluff') {
      expectExactKeys(
        view,
        recipient === 'host'
          ? [
              'phase',
              'round',
              'totalRounds',
              'question',
              'submittedCount',
              'totalPlayers',
              'deadline',
            ]
          : ['phase', 'round', 'totalRounds', 'question', 'submitted', 'deadline'],
      )
    } else {
      expectExactKeys(
        view,
        recipient === 'host'
          ? [
              'phase',
              'round',
              'totalRounds',
              'question',
              'options',
              'pickedCount',
              'totalPlayers',
              'deadline',
            ]
          : [
              'phase',
              'round',
              'totalRounds',
              'question',
              'options',
              'yourPick',
              'deadline',
            ],
      )
      for (const option of view.options as unknown[]) {
        expectExactKeys(option, recipient === 'host' ? ['id', 'text'] : ['id', 'text', 'yours'])
      }
    }
  }
}

test('host + three players play a Bluff Battle round without pre-reveal leaks', async ({
  browser,
}) => {
  const captured: CapturedState[] = []
  const host = await (await browser.newContext()).newPage()
  captureRoomStates(host, 'host', captured)
  await host.goto('/host')
  const code = await host.getByTestId('room-code').innerText()

  const playerPages: Page[] = []
  for (const name of ['Ana', 'Ben', 'Cy']) {
    const page = await (await browser.newContext()).newPage()
    captureRoomStates(page, 'player', captured)
    await join(page, code, name)
    playerPages.push(page)
  }
  for (const name of ['Ana', 'Ben', 'Cy']) {
    await expect(host.getByText(name, { exact: true })).toBeVisible()
  }

  await host.getByRole('button', { name: 'Bluff Battle', exact: true }).click()
  const controller = io('http://localhost:4000', { transports: ['websocket'] })
  const hostToken = await host.evaluate(
    (roomCode: string) => sessionStorage.getItem(`hpg:hostToken:${roomCode}`) ?? '',
    code,
  )
  expect(await controller.emitWithAck('room:watch', { code, hostToken })).toMatchObject({ ok: true })
  expect(
    await controller.emitWithAck('game:start', {
      gameId: 'bluff-battle',
      tone: 'family',
      rounds: 1,
    }),
  ).toEqual({ ok: true })
  await expect(host.getByText(/submitted$/)).toBeVisible()

  await expect(playerPages[0].getByPlaceholder('Your bluff (max 100 chars)')).toBeVisible()
  const question = (await playerPages[0].locator('h2').innerText()).trim()
  const truth = answersByQuestion[question]
  expect(truth).toBeTruthy()
  await playerPages[0].getByPlaceholder('Your bluff (max 100 chars)').fill(truth)
  await playerPages[0].getByRole('button', { name: 'Submit bluff' }).click()
  await expect(playerPages[0].getByText("That's the real answer — too easy! Try another.")).toBeVisible()

  for (const [index, [page, bluff]] of playerPages
    .map((page, playerIndex) => [
      page,
      playerIndex < 2 ? 'Shared nonsense' : 'Different nonsense',
    ] as [Page, string])
    .entries()) {
    await page.getByPlaceholder('Your bluff (max 100 chars)').fill(bluff)
    await page.getByRole('button', { name: 'Submit bluff' }).click()
    if (index < 2) await expect(page.getByText('Bluff locked in 😈')).toBeVisible()
  }

  for (const page of playerPages) {
    await expect(page.getByText('Pick the real answer')).toBeVisible()
  }
  expectPreRevealAllowlists(captured)

  const sharedOnAna = playerPages[0].getByRole('button', { name: /Shared nonsense.*yours/ })
  await expect(sharedOnAna).toBeDisabled()
  await playerPages[0].getByRole('button', { name: /Different nonsense/ }).click()
  await playerPages[1].getByRole('button', { name: truth, exact: true }).click()
  await playerPages[2].getByRole('button', { name: /Shared nonsense/ }).click()

  await expect(host.getByText(`Real answer: ${truth}`)).toBeVisible()
  const sharedResult = host.getByText('Shared nonsense', { exact: true }).locator('..')
  await expect(sharedResult).toContainText('By Ana, Ben')
  await expect(sharedResult).toContainText('Picked by Cy')
  const differentResult = host.getByText('Different nonsense', { exact: true }).locator('..')
  await expect(differentResult).toContainText('By Cy')
  await expect(differentResult).toContainText('Picked by Ana')
  await expect(host.getByText('Picked by Ben').locator('..')).toContainText('✓ truth')
  const playerSharedResult = playerPages[0].getByText('Shared nonsense', { exact: true }).locator('..')
  await expect(playerSharedResult).toContainText('By Ana, Ben')
  const playerDifferentResult = playerPages[0]
    .getByText('Different nonsense', { exact: true })
    .locator('..')
  await expect(playerDifferentResult).toContainText('By Cy')
  await expect(playerPages[0].getByText('Fooled: Cy')).toBeVisible()
  await expect(playerPages[0].getByText('Fooled: Ana')).toBeVisible()
  await expect(playerPages[0].getByText('Fooled: Ben')).toBeVisible()

  for (const page of [host, ...playerPages]) {
    await expect(page.getByRole('listitem').filter({ hasText: 'Ben' })).toContainText('3 pts')
    await expect(page.getByRole('listitem').filter({ hasText: 'Ana' })).toContainText('1 pts')
    await expect(page.getByRole('listitem').filter({ hasText: 'Cy' })).toContainText('1 pts')
  }
  await expect(host.getByRole('button', { name: 'Next', exact: true })).toBeVisible()
  await host.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(host.getByText('Best bluffers & truth seekers')).toBeVisible()
  for (const page of playerPages) await expect(page.getByText('Final results')).toBeVisible()
  for (const page of [host, ...playerPages]) {
    await expect(page.getByRole('listitem').filter({ hasText: 'Ben' })).toContainText('3 pts')
    await expect(page.getByRole('listitem').filter({ hasText: 'Ana' })).toContainText('1 pts')
    await expect(page.getByRole('listitem').filter({ hasText: 'Cy' })).toContainText('1 pts')
  }

  await host.getByRole('button', { name: 'Back to lobby' }).click()
  await expect(host.getByTestId('room-code')).toHaveText(code)
  for (const page of playerPages) {
    await expect(page.getByText('Waiting for the host to start…')).toBeVisible()
  }
  controller.disconnect()
})

test('a missing input acknowledgement shows a retryable error and re-enables submission', async ({
  browser,
}) => {
  const host = await (await browser.newContext()).newPage()
  await host.goto('/host')
  const code = await host.getByTestId('room-code').innerText()

  const anaContext = await browser.newContext()
  const ana = await anaContext.newPage()
  await join(ana, code, 'Ana')
  for (const name of ['Ben', 'Cy']) {
    const page = await (await browser.newContext()).newPage()
    await join(page, code, name)
  }
  await expect(host.getByText('Cy', { exact: true })).toBeVisible()

  const controller = io('http://localhost:4000', { transports: ['websocket'] })
  const hostToken = await host.evaluate(
    (roomCode: string) => sessionStorage.getItem(`hpg:hostToken:${roomCode}`) ?? '',
    code,
  )
  expect(await controller.emitWithAck('room:watch', { code, hostToken })).toMatchObject({ ok: true })
  expect(
    await controller.emitWithAck('game:start', {
      gameId: 'bluff-battle',
      tone: 'family',
      rounds: 1,
    }),
  ).toEqual({ ok: true })
  await expect(ana.getByPlaceholder('Your bluff (max 100 chars)')).toBeVisible()

  await anaContext.setOffline(true)
  await ana.getByPlaceholder('Your bluff (max 100 chars)').fill('Connection test bluff')
  await ana.getByRole('button', { name: 'Submit bluff' }).click()
  await expect(ana.getByText("Couldn't submit that. Check your connection and try again.")).toBeVisible({
    timeout: 8_000,
  })
  await expect(ana.getByRole('button', { name: 'Submit bluff' })).toBeEnabled()

  await anaContext.setOffline(false)
  controller.disconnect()
})
