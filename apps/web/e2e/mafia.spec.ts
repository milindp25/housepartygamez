import { expect, test, type Page } from '@playwright/test'
import type { MafiaRole, RoomStateMsg } from '@hpg/shared'

interface CapturedState {
  recipient: 'host' | string
  message: RoomStateMsg
}

async function join(page: Page, code: string, nickname: string): Promise<void> {
  await page.goto('/join')
  await page.getByPlaceholder('ROOM CODE').fill(code)
  await page.getByPlaceholder('Your nickname').fill(nickname)
  await page.getByRole('button', { name: 'Join' }).click()
}

function captureRoomStates(
  page: Page,
  recipient: string,
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

function expectMafiaFrameAllowlists(
  captured: CapturedState[],
  rolesByName: Map<string, MafiaRole>,
  eliminated: { nickname: string; role: MafiaRole },
): void {
  const frames = captured.filter(
    ({ message }) =>
      message.game?.id === 'mafia' &&
      ['night', 'day', 'vote', 'reveal'].includes(
        (message.game.view as { phase: string }).phase,
      ),
  )
  for (const phase of ['night', 'day', 'vote', 'reveal']) {
    expect(
      frames.some(
        ({ recipient, message }) =>
          recipient === 'host' && (message.game?.view as { phase: string }).phase === phase,
      ),
    ).toBe(true)
    for (const role of ['mafia', 'doctor', 'detective', 'civilian']) {
      expect(
        frames.some(({ recipient, message }) => {
          const view = message.game?.view as { phase: string; role?: string }
          return recipient !== 'host' && view.phase === phase && view.role === role
        }),
      ).toBe(true)
    }
  }

  const hostPhaseKeys: Record<string, string[]> = {
    night: ['phase', 'day', 'players', 'actionsDone', 'actionsNeeded', 'deadline'],
    day: ['phase', 'day', 'players', 'lastNight', 'deadline'],
    vote: ['phase', 'day', 'players', 'votedCount', 'totalVoters', 'deadline'],
    reveal: ['phase', 'day', 'players', 'eliminatedNickname', 'revealedRole', 'tally'],
  }
  const playerPhaseKeys: Record<string, string[]> = {
    night: ['phase', 'day', 'players', 'role', 'isAlive', 'action', 'candidates', 'yourTarget', 'deadline'],
    day: ['phase', 'day', 'players', 'role', 'isAlive', 'lastNight', 'deadline'],
    vote: ['phase', 'day', 'players', 'role', 'isAlive', 'candidates', 'yourVote', 'deadline'],
    reveal: ['phase', 'day', 'players', 'role', 'isAlive', 'eliminatedNickname', 'revealedRole', 'tally'],
  }

  for (const { recipient, message } of frames) {
    expectExactKeys(message, ['code', 'phase', 'players', 'game'])
    expectExactKeys(message.game, ['id', 'view'])
    for (const player of message.players) expectExactKeys(player, ['id', 'nickname', 'connected'])
    const view = message.game?.view as Record<string, unknown>
    const phase = view.phase as string
    if (recipient !== 'host') expect(view.role).toBe(rolesByName.get(recipient))
    if (phase === 'reveal') {
      expect(view.eliminatedNickname).toBe(eliminated.nickname)
      expect(view.revealedRole).toBe(eliminated.role)
    }
    const expected =
      recipient === 'host'
        ? hostPhaseKeys[phase]
        : [
            ...playerPhaseKeys[phase],
            ...(view.role === 'mafia' ? ['mafiaTeam'] : []),
            ...(view.role === 'detective' ? ['detectiveLog'] : []),
          ]
    expectExactKeys(view, expected)
    for (const player of view.players as unknown[]) expectExactKeys(player, ['id', 'nickname', 'alive'])
    if ('candidates' in view) {
      for (const candidate of view.candidates as unknown[]) {
        expectExactKeys(candidate, ['id', 'nickname'])
      }
    }
    if ('lastNight' in view) expectExactKeys(view.lastNight, ['killedNickname', 'saved'])
    if ('tally' in view) {
      for (const row of view.tally as unknown[]) expectExactKeys(row, ['nickname', 'count'])
    }
    if ('detectiveLog' in view) {
      for (const entry of view.detectiveLog as unknown[]) {
        expectExactKeys(entry, ['targetNickname', 'isMafia'])
      }
    }
  }
}

test('seven phones play Mafia through a saved night and elimination without pre-finished leaks', async ({
  browser,
}) => {
  const captured: CapturedState[] = []
  const host = await (await browser.newContext()).newPage()
  captureRoomStates(host, 'host', captured)
  await host.goto('/host')
  const code = await host.getByTestId('room-code').innerText()

  const players: Array<{ name: string; page: Page }> = []
  for (let index = 1; index <= 7; index += 1) {
    const page = await (await browser.newContext()).newPage()
    const name = `Player ${index}`
    captureRoomStates(page, name, captured)
    await join(page, code, name)
    players.push({ name, page })
  }
  await expect(host.getByText('Player 7', { exact: true })).toBeVisible()

  await host.getByRole('button', { name: /Mafia/ }).click()
  await expect(host.getByText('6–20 players')).toBeVisible()
  await expect(host.getByRole('button', { name: 'family', exact: true })).toHaveCount(0)
  await expect(host.getByRole('button', { name: /spicy/i })).toHaveCount(0)
  let adultDialog = false
  host.on('dialog', async (dialog) => {
    adultDialog = true
    await dialog.dismiss()
  })
  await host.getByRole('button', { name: 'Start Mafia', exact: true }).click()

  const byRole = new Map<MafiaRole, Array<{ name: string; page: Page }>>()
  const rolesByName = new Map<string, MafiaRole>()
  for (const player of players) {
    await expect(player.page.getByText(/You are the/)).toBeVisible()
    const roleText = await player.page.getByText(/You are the/).innerText()
    const role: MafiaRole = roleText.includes('MAFIA')
      ? 'mafia'
      : roleText.includes('DOCTOR')
        ? 'doctor'
        : roleText.includes('DETECTIVE')
          ? 'detective'
          : 'civilian'
    byRole.set(role, [...(byRole.get(role) ?? []), player])
    rolesByName.set(player.name, role)
  }
  expect(adultDialog).toBe(false)
  expect(byRole.get('mafia')).toHaveLength(1)
  expect(byRole.get('doctor')).toHaveLength(1)
  expect(byRole.get('detective')).toHaveLength(1)
  expect(byRole.get('civilian')).toHaveLength(4)

  const mafioso = byRole.get('mafia')![0]
  const doctor = byRole.get('doctor')![0]
  const detective = byRole.get('detective')![0]
  const victim = byRole.get('civilian')![0]
  await expect(mafioso.page.getByText(new RegExp(`team: ${mafioso.name}`))).toBeVisible()
  await expect(byRole.get('civilian')![1].page.getByText('😴 The town sleeps…')).toBeVisible()

  await detective.page.getByRole('button', { name: mafioso.name, exact: true }).click()
  await doctor.page.getByRole('button', { name: victim.name, exact: true }).click()
  await mafioso.page.getByRole('button', { name: victim.name, exact: true }).click()

  await expect(host.getByText('The Doctor saved someone last night!')).toBeVisible()
  await expect(victim.page.getByText('The Doctor saved someone last night!')).toBeVisible()
  await expect(detective.page.getByText(`${mafioso.name}: MAFIA`)).toBeVisible()
  await host.getByRole('button', { name: 'Start the vote' }).click()

  for (const player of players) {
    const target = player.name === victim.name ? doctor.name : victim.name
    await player.page.getByRole('button', { name: target, exact: true }).click()
  }
  await expect(host.getByText(`${victim.name} was eliminated`)).toBeVisible()
  await expect(host.getByText(/CIVILIAN/)).toBeVisible()
  await expect(victim.page.getByText(`${victim.name} was eliminated`)).toBeVisible()
  await host.getByRole('button', { name: 'Nightfall' }).click()

  await expect(
    victim.page.getByText("💀 You're out — no spoilers on your face, please"),
  ).toBeVisible()
  await expect(victim.page.locator('main').getByRole('button')).toHaveCount(0)
  await expect(host.getByText(`🌙 Night 2 — the town sleeps`)).toBeVisible()
  expectMafiaFrameAllowlists(captured, rolesByName, {
    nickname: victim.name,
    role: 'civilian',
  })
})
