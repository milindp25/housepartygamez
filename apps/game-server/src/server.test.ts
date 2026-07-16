import { createServer, type Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { io as connect, type Socket } from 'socket.io-client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type {
  ClientToServerEvents,
  JoinResult,
  MafiaState,
  RoomStateMsg,
  ServerToClientEvents,
} from '@hpg/shared'
import { bluffFamily } from '@hpg/content'
import { attachGameServer, resolveCorsOrigin } from './server'
import { RoomManager } from './roomManager'
import type { RoomTimers } from './timers'

type Client = Socket<ServerToClientEvents, ClientToServerEvents>

let httpServer: HttpServer
let url: string
let serverRooms: RoomManager
let roomTimers: RoomTimers
const clients: Client[] = []

function client(): Client {
  const c: Client = connect(url, { transports: ['websocket'] })
  clients.push(c)
  return c
}

/** Create a room and unwrap the ack; throws on the (unexpected) failure path. */
async function createRoom(c: Client): Promise<{ code: string; hostToken: string }> {
  const res = await c.emitWithAck('room:create')
  if (!res.ok) throw new Error(res.error)
  return res
}

function nextState(
  c: Client,
  predicate: (msg: RoomStateMsg) => boolean = () => true,
): Promise<RoomStateMsg> {
  // Wait for the next `room:state` that satisfies `predicate`. Intermediate
  // broadcasts (from prior votes still racing to arrive on this socket) are
  // dropped rather than mistakenly caught — the tests care about a specific
  // phase transition, not "whatever fires next".
  return new Promise((resolve) => {
    const handler = (msg: RoomStateMsg) => {
      if (predicate(msg)) {
        c.off('room:state', handler)
        resolve(msg)
      }
    }
    c.on('room:state', handler)
  })
}

/** Convenience: wait for a state whose game view has a specific `phase`. */
function nextGamePhase(c: Client, phase: string): Promise<RoomStateMsg> {
  return nextState(c, (m) => {
    const view = m.game?.view as { phase?: string } | undefined
    return view?.phase === phase
  })
}

function expectExactKeys(value: unknown, keys: string[]): void {
  expect(Object.keys(value as Record<string, unknown>).sort()).toEqual([...keys].sort())
}

const bluffFamilyAnswers = Object.fromEntries(
  bluffFamily.prompts.map(({ question, answer }) => [question, answer]),
)

beforeAll(async () => {
  httpServer = createServer()
  // The shared suite below makes dozens of room:create/room:join calls from
  // the same loopback IP — far more than production's per-IP rate limits
  // allow. Give this instance a generous test-only budget; the rate limiter's
  // actual throttling behavior is covered by dedicated isolated-instance
  // tests further down, the same pattern the maxRooms capacity test uses.
  const attached = attachGameServer(httpServer, undefined, {
    roomCreateLimit: { max: 10_000, windowMs: 60_000 },
    joinAttemptLimit: { max: 10_000, windowMs: 60_000 },
  })
  serverRooms = attached.rooms
  roomTimers = attached.timers
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`
})

afterAll(async () => {
  for (const c of clients) c.disconnect()
  await new Promise<void>((resolve) => httpServer.close(() => resolve()))
})

describe('resolveCorsOrigin', () => {
  it('honours an explicit CORS_ORIGIN', () => {
    expect(resolveCorsOrigin({ CORS_ORIGIN: 'https://housepartygamez.com' })).toBe(
      'https://housepartygamez.com',
    )
  })
  it('stays permissive outside production so localhost:3000 can reach :4000', () => {
    expect(resolveCorsOrigin({})).toBe('*')
    expect(resolveCorsOrigin({ NODE_ENV: 'test' })).toBe('*')
  })
  it('fails closed in production when CORS_ORIGIN is unset', () => {
    expect(resolveCorsOrigin({ NODE_ENV: 'production' })).toBe(false)
  })
})

describe('game server sockets', () => {
  it('host creates a room, player joins, everyone gets lobby state', async () => {
    const host = client()
    const { code } = await createRoom(host)
    expect(code).toMatch(/^[A-Z]{4}$/)

    const phone = client()
    const stateAtHost = nextState(host)
    const join = await phone.emitWithAck('room:join', {
      code,
      nickname: 'Milind',
      playerToken: 'tok-1',
    })
    expect(join.ok).toBe(true)
    const view = await stateAtHost
    expect(view.players).toEqual([{ id: expect.any(String), nickname: 'Milind', connected: true }])
  })

  it('join errors are returned in the ack', async () => {
    const phone = client()
    const res: JoinResult = await phone.emitWithAck('room:join', {
      code: 'XXXX',
      nickname: 'Nobody',
      playerToken: 'tok-x',
    })
    expect(res).toEqual({ ok: false, error: 'Room not found' })
  })

  it('disconnect marks the player disconnected; same token reconnects to the seat', async () => {
    const host = client()
    const { code } = await createRoom(host)

    const phone = client()
    const joined = await phone.emitWithAck('room:join', {
      code,
      nickname: 'Ana',
      playerToken: 'tok-ana',
    })
    if (!joined.ok) throw new Error(joined.error)

    const afterDrop = nextState(host)
    phone.disconnect()
    expect((await afterDrop).players[0].connected).toBe(false)

    const afterRejoin = nextState(host)
    const phone2 = client()
    const rejoined = await phone2.emitWithAck('room:join', {
      code,
      nickname: 'Ana',
      playerToken: 'tok-ana',
    })
    if (!rejoined.ok) throw new Error(rejoined.error)
    expect(rejoined.playerId).toBe(joined.playerId)
    const view = await afterRejoin
    expect(view.players).toHaveLength(1)
    expect(view.players[0].connected).toBe(true)
  })

  it('a second host screen can watch an existing room', async () => {
    const host = client()
    const { code, hostToken } = await createRoom(host)
    const tv2 = client()
    const res = await tv2.emitWithAck('room:watch', { code, hostToken })
    expect(res).toEqual({ ok: true, view: { code, phase: 'lobby', players: [] } })
  })

  it('rejects malformed room:watch payloads and missing acks without crashing', async () => {
    const tv = client()
    for (const payload of [undefined, null, 42, { code: 7 }] as unknown[]) {
      const res = await tv.emitWithAck('room:watch', payload as never)
      expect(res).toEqual({ ok: false, error: 'Invalid watch request' })
    }
    // Emit with no ack callback at all — must not throw server-side.
    ;(tv as unknown as { emit(event: 'room:watch', payload: unknown): void }).emit(
      'room:watch',
      null,
    )
    // Server is still alive: a normal create round-trips.
    const { code } = await createRoom(tv)
    expect(code).toMatch(/^[A-Z]{4}$/)
  })

  it('rejects room:watch with a wrong host token using the same error as a missing room', async () => {
    const host = client()
    const { code } = await createRoom(host)
    const stranger = client()
    const res = await stranger.emitWithAck('room:watch', { code, hostToken: 'not-the-token' })
    expect(res).toEqual({ ok: false, error: 'Room not found' })
  })

  it('grants host powers to room:watch with the correct token', async () => {
    const host = client()
    const { code, hostToken } = await createRoom(host)
    const second = client()
    const res = await second.emitWithAck('room:watch', { code, hostToken })
    expect(res).toMatchObject({ ok: true })
  })

  it('rejects room creation when the server is at capacity', async () => {
    const capServer = createServer()
    attachGameServer(capServer, new RoomManager(), { maxRooms: 1 })
    await new Promise<void>((resolve) => capServer.listen(0, resolve))
    const capUrl = `http://localhost:${(capServer.address() as AddressInfo).port}`
    const c: Client = connect(capUrl, { transports: ['websocket'] })
    try {
      const first = await c.emitWithAck('room:create')
      expect(first.ok).toBe(true)
      const second = await c.emitWithAck('room:create')
      expect(second).toEqual({
        ok: false,
        error: 'Server is busy — try again in a few minutes',
      })
    } finally {
      c.disconnect()
      await new Promise<void>((resolve) => capServer.close(() => resolve()))
    }
  })

  it('rate-limits room:create per IP, independent of maxRooms', async () => {
    const limitedServer = createServer()
    attachGameServer(limitedServer, new RoomManager(), {
      roomCreateLimit: { max: 2, windowMs: 60_000 },
    })
    await new Promise<void>((resolve) => limitedServer.listen(0, resolve))
    const limitedUrl = `http://localhost:${(limitedServer.address() as AddressInfo).port}`
    const c: Client = connect(limitedUrl, { transports: ['websocket'] })
    try {
      expect((await c.emitWithAck('room:create')).ok).toBe(true)
      expect((await c.emitWithAck('room:create')).ok).toBe(true)
      expect(await c.emitWithAck('room:create')).toEqual({
        ok: false,
        error: 'Too many rooms created — try again in a few minutes',
      })
    } finally {
      c.disconnect()
      await new Promise<void>((resolve) => limitedServer.close(() => resolve()))
    }
  })

  it('rate-limits room:join attempts per IP — including a room-code brute-force spread across many sockets', async () => {
    const limitedServer = createServer()
    attachGameServer(limitedServer, new RoomManager(), {
      joinAttemptLimit: { max: 3, windowMs: 60_000 },
    })
    await new Promise<void>((resolve) => limitedServer.listen(0, resolve))
    const limitedUrl = `http://localhost:${(limitedServer.address() as AddressInfo).port}`
    const host: Client = connect(limitedUrl, { transports: ['websocket'] })
    const created = await host.emitWithAck('room:create')
    if (!created.ok) throw new Error(created.error)
    try {
      // Three failed guesses from three DIFFERENT sockets — same machine, same
      // IP, which is exactly the multi-connection brute-force shape a real
      // attacker uses to get around a naive per-socket limit.
      for (let i = 0; i < 3; i++) {
        const guesser: Client = connect(limitedUrl, { transports: ['websocket'] })
        const res = await guesser.emitWithAck('room:join', {
          code: 'ZZZZ',
          nickname: 'Guesser',
          playerToken: `tok-${i}`,
        })
        expect(res).toEqual({ ok: false, error: 'Room not found' })
        guesser.disconnect()
      }
      // A fourth attempt from yet another socket, same IP — even the REAL
      // code should now be rejected by the rate limit, not looked up.
      const fourth: Client = connect(limitedUrl, { transports: ['websocket'] })
      const res = await fourth.emitWithAck('room:join', {
        code: created.code,
        nickname: 'TooLate',
        playerToken: 'tok-real',
      })
      expect(res).toEqual({ ok: false, error: 'Too many attempts — try again in a minute' })
      fourth.disconnect()
    } finally {
      host.disconnect()
      await new Promise<void>((resolve) => limitedServer.close(() => resolve()))
    }
  })

  it('rejects malformed game:start payloads and invalid rounds without crashing', async () => {
    const host = client()
    const { code, hostToken } = await createRoom(host)

    for (const payload of [null, 42, { gameId: 7, tone: 'family' }] as unknown[]) {
      const res = await host.emitWithAck('game:start', payload as never)
      expect(res).toEqual({ ok: false, error: 'Invalid start request' })
    }
    for (const rounds of [0, -1, 2.5, '9', 1e9] as unknown[]) {
      const res = await host.emitWithAck('game:start', {
        gameId: 'would-you-rather',
        tone: 'family',
        rounds,
      } as never)
      expect(res).toEqual({ ok: false, error: 'Invalid rounds' })
    }
    // Emit with no ack callback — must not throw server-side.
    ;(host as unknown as { emit(event: 'game:start', payload: unknown): void }).emit(
      'game:start',
      null,
    )
    // Server is still alive.
    const watch = await host.emitWithAck('room:watch', { code, hostToken })
    expect(watch.ok).toBe(true)
  })

  it('rejects malformed game:input payloads and missing acks without crashing', async () => {
    const host = client()
    const { code, hostToken } = await createRoom(host)
    const phone = client()
    const joined = await phone.emitWithAck('room:join', {
      code,
      nickname: 'Mal',
      playerToken: 'tok-malformed-input',
    })
    if (!joined.ok) throw new Error(joined.error)

    for (const payload of [null, 42, 'submit'] as unknown[]) {
      const res = await phone.emitWithAck('game:input', payload as never)
      expect(res).toEqual({ ok: false, error: 'Invalid input request' })
    }
    // Emit with no ack callback — must not throw server-side.
    ;(phone as unknown as { emit(event: 'game:input', payload: unknown): void }).emit(
      'game:input',
      null,
    )
    // Server is still alive.
    const watch = await host.emitWithAck('room:watch', { code, hostToken })
    expect(watch.ok).toBe(true)
  })

  it('keeps a same-token seat online until its final live socket disconnects', async () => {
    const host = client()
    const { code } = await createRoom(host)
    const oldAna = client()
    const ben = client()
    const cy = client()
    await oldAna.emitWithAck('room:join', {
      code,
      nickname: 'Ana',
      playerToken: 'overlap-ana',
    })
    await ben.emitWithAck('room:join', { code, nickname: 'Ben', playerToken: 'overlap-ben' })
    await cy.emitWithAck('room:join', { code, nickname: 'Cy', playerToken: 'overlap-cy' })
    const bluffAtHost = nextGamePhase(host, 'bluff')
    expect(
      await host.emitWithAck('game:start', {
        gameId: 'bluff-battle',
        tone: 'family',
        rounds: 1,
      }),
    ).toEqual({ ok: true })
    await bluffAtHost

    const newAna = client()
    const rejoined = await newAna.emitWithAck('room:join', {
      code,
      nickname: 'Ana',
      playerToken: 'overlap-ana',
    })
    expect(rejoined.ok).toBe(true)
    oldAna.disconnect()
    await new Promise((resolve) => setTimeout(resolve, 25))

    const room = serverRooms.getRoom(code)!
    expect(room.players.find((player) => player.token === 'overlap-ana')?.connected).toBe(true)
    expect(serverRooms.toHostState(room).game?.view).toMatchObject({
      phase: 'bluff',
      submittedCount: 0,
      totalPlayers: 3,
    })

    const finalDrop = nextState(host, (message) =>
      message.players.some((player) => player.nickname === 'Ana' && !player.connected),
    )
    newAna.disconnect()
    expect(await finalDrop).toMatchObject({
      game: { view: { phase: 'bluff', submittedCount: 0, totalPlayers: 2 } },
    })

    host.disconnect()
    await new Promise((resolve) => setTimeout(resolve, 25))
    expect(
      room.players
        .filter((player) => ['Ben', 'Cy'].includes(player.nickname))
        .map((p) => p.connected),
    ).toEqual([true, true])
  })
})

describe('game flow over sockets', () => {
  it('re-arms the authoritative phase timer when reconnect advances Bluff Battle', async () => {
    const host = client()
    const { code } = await createRoom(host)
    const phones = [client(), client(), client()]
    for (const [index, phone] of phones.entries()) {
      await phone.emitWithAck('room:join', {
        code,
        nickname: ['Ana', 'Ben', 'Cy'][index],
        playerToken: `timer-rejoin-${index}`,
      })
    }
    const bluffAtHost = nextGamePhase(host, 'bluff')
    await host.emitWithAck('game:start', { gameId: 'bluff-battle', tone: 'family', rounds: 1 })
    const bluffView = (await bluffAtHost).game?.view as { deadline: number; phase: string }
    expect(roomTimers.deadlineFor(code)).toBe(bluffView.deadline)
    expect(
      await phones[0].emitWithAck('game:input', { input: { text: 'Already submitted' } }),
    ).toEqual({ ok: true, accepted: true })

    for (const phone of phones) {
      const disconnectedAtHost = nextState(host, (message) => {
        const view = message.game?.view as { phase?: string; totalPlayers?: number } | undefined
        return (
          view?.phase === 'bluff' && view.totalPlayers === phones.length - phones.indexOf(phone) - 1
        )
      })
      phone.disconnect()
      await disconnectedAtHost
    }
    expect(
      (serverRooms.toHostState(serverRooms.getRoom(code)!).game?.view as { phase: string }).phase,
    ).toBe('bluff')

    const voteAtHost = nextGamePhase(host, 'vote')
    const reconnectedAna = client()
    const rejoined = await reconnectedAna.emitWithAck('room:join', {
      code,
      nickname: 'Ana',
      playerToken: 'timer-rejoin-0',
    })
    expect(rejoined.ok).toBe(true)
    const voteView = (await voteAtHost).game?.view as { deadline: number; phase: string }
    expect(voteView.phase).toBe('vote')
    expect(voteView.deadline).not.toBe(bluffView.deadline)
    expect(roomTimers.deadlineFor(code)).toBe(voteView.deadline)
  })

  it('host starts WYR, players vote, reveal broadcasts, host ends game', async () => {
    const host = client()
    const { code } = await createRoom(host)
    const p1 = client()
    const p2 = client()
    await p1.emitWithAck('room:join', { code, nickname: 'Ana', playerToken: 'g-tok-1' })
    await p2.emitWithAck('room:join', { code, nickname: 'Ben', playerToken: 'g-tok-2' })

    const hostGameState = nextState(host)
    const started = await host.emitWithAck('game:start', {
      gameId: 'would-you-rather',
      tone: 'friends',
      rounds: 1,
    })
    expect(started).toEqual({ ok: true })
    const hostMsg = await hostGameState
    expect(hostMsg.phase).toBe('game')
    expect(hostMsg.game?.view).toMatchObject({ phase: 'vote', votedCount: 0, totalPlayers: 2 })

    expect(await p1.emitWithAck('game:input', { input: { choice: 'a' } })).toEqual({
      ok: true,
      accepted: true,
    })
    const revealAtHost = nextGamePhase(host, 'reveal')
    const revealAtP2 = nextGamePhase(p2, 'reveal')
    expect(await p2.emitWithAck('game:input', { input: { choice: 'a' } })).toEqual({
      ok: true,
      accepted: true,
    })
    expect((await revealAtHost).game?.view).toMatchObject({
      phase: 'reveal',
      counts: { a: 2, b: 0 },
    })
    expect((await revealAtP2).game?.view).toMatchObject({ phase: 'reveal', yourChoice: 'a' })

    const backToLobby = nextState(p1, (m) => m.phase === 'lobby')
    host.emit('game:end')
    expect((await backToLobby).phase).toBe('lobby')
  })

  it('players cannot start games; only the host can', async () => {
    const host = client()
    const { code } = await createRoom(host)
    const p1 = client()
    await p1.emitWithAck('room:join', { code, nickname: 'Ana', playerToken: 'g-tok-3' })
    const res = await p1.emitWithAck('game:start', { gameId: 'would-you-rather', tone: 'friends' })
    expect(res).toEqual({ ok: false, error: 'Only the host can start a game' })
  })

  it('starts prompt-less Mafia and sends exact role-specific night snapshots', async () => {
    const host = client()
    const { code } = await createRoom(host)
    const phones = Array.from({ length: 7 }, () => client())
    const joins = await Promise.all(
      phones.map((phone, index) =>
        phone.emitWithAck('room:join', {
          code,
          nickname: `Mafia ${index + 1}`,
          playerToken: `mafia-start-${index}`,
        }),
      ),
    )
    const joinedPlayerIds = joins.map((join) => {
      if (!join.ok) throw new Error('Failed to seat Mafia players')
      return join.playerId
    })

    const atHost = nextGamePhase(host, 'night')
    const atPlayers = phones.map((phone) => nextGamePhase(phone, 'night'))
    expect(
      await host.emitWithAck('game:start', {
        gameId: 'mafia',
        tone: 'spicy',
      }),
    ).toEqual({ ok: true })

    const hostView = (await atHost).game?.view as Record<string, unknown>
    const playerViews = (await Promise.all(atPlayers)).map(
      (message) => message.game?.view as Record<string, unknown>,
    )
    expectExactKeys(hostView, [
      'phase',
      'day',
      'players',
      'actionsDone',
      'actionsNeeded',
      'deadline',
    ])
    for (const player of hostView.players as unknown[]) {
      expectExactKeys(player, ['id', 'nickname', 'alive'])
    }

    const expectedKeysByRole: Record<string, string[]> = {
      mafia: [
        'phase',
        'day',
        'players',
        'role',
        'isAlive',
        'mafiaTeam',
        'action',
        'candidates',
        'yourTarget',
        'deadline',
      ],
      detective: [
        'phase',
        'day',
        'players',
        'role',
        'isAlive',
        'detectiveLog',
        'action',
        'candidates',
        'yourTarget',
        'deadline',
      ],
      doctor: [
        'phase',
        'day',
        'players',
        'role',
        'isAlive',
        'action',
        'candidates',
        'yourTarget',
        'deadline',
      ],
      civilian: [
        'phase',
        'day',
        'players',
        'role',
        'isAlive',
        'action',
        'candidates',
        'yourTarget',
        'deadline',
      ],
    }
    expect(new Set(playerViews.map((view) => view.role))).toEqual(
      new Set(['mafia', 'detective', 'doctor', 'civilian']),
    )
    const state = serverRooms.getRoom(code)?.game?.state as MafiaState
    for (const [index, view] of playerViews.entries()) {
      expect(view.role).toBe(state.roles[joinedPlayerIds[index]])
      expectExactKeys(view, expectedKeysByRole[view.role as string])
      for (const player of view.players as unknown[]) {
        expectExactKeys(player, ['id', 'nickname', 'alive'])
      }
      for (const candidate of view.candidates as unknown[]) {
        expectExactKeys(candidate, ['id', 'nickname'])
      }
    }
  })

  it('safely rejects a new seat during Mafia while reconnects and existing actions stay healthy', async () => {
    const host = client()
    const { code } = await createRoom(host)
    const phones = Array.from({ length: 4 }, () => client())
    const joins = await Promise.all(
      phones.map((phone, index) =>
        phone.emitWithAck('room:join', {
          code,
          nickname: `Active ${index + 1}`,
          playerToken: `active-mafia-${index}`,
        }),
      ),
    )
    const playerIds = joins.map((join) => {
      if (!join.ok) throw new Error(join.error)
      return join.playerId
    })
    const startedAtHost = nextGamePhase(host, 'night')
    expect(await host.emitWithAck('game:start', { gameId: 'mafia', tone: 'family' })).toEqual({
      ok: true,
    })
    await startedAtHost

    const room = serverRooms.getRoom(code)!
    const state = room.game?.state as MafiaState
    const mafiaIndex = playerIds.findIndex((playerId) => state.roles[playerId] === 'mafia')
    const mafiosoId = playerIds[mafiaIndex]
    const victimId = playerIds.find((playerId) => state.roles[playerId] !== 'mafia')!

    const late = client()
    expect(
      await late.timeout(500).emitWithAck('room:join', {
        code,
        nickname: 'Late player',
        playerToken: 'brand-new-active-token',
      }),
    ).toEqual({ ok: false, error: 'Game already running' })
    expect(room.players).toHaveLength(4)

    const disconnectedAtHost = nextState(host, (message) =>
      message.players.some((player) => player.id === mafiosoId && !player.connected),
    )
    phones[mafiaIndex].disconnect()
    await disconnectedAtHost

    const reconnectedMafioso = client()
    const reconnect = await reconnectedMafioso.emitWithAck('room:join', {
      code,
      nickname: 'Ignored rename',
      playerToken: `active-mafia-${mafiaIndex}`,
    })
    expect(reconnect).toMatchObject({ ok: true, playerId: mafiosoId })
    expect(room.players).toHaveLength(4)

    const actionAtHost = nextState(host, (message) => {
      const view = message.game?.view as { phase?: string; actionsDone?: number } | undefined
      return view?.phase === 'night' && view.actionsDone === 1
    })
    expect(
      await reconnectedMafioso.emitWithAck('game:input', { input: { targetId: victimId } }),
    ).toEqual({ ok: true, accepted: true })
    expect((await actionAtHost).players).toHaveLength(4)
  })

  it('rejects starting Mafia below its four-player technical minimum', async () => {
    const host = client()
    const { code } = await createRoom(host)
    const phones = [client(), client(), client()]
    for (const [index, phone] of phones.entries()) {
      await phone.emitWithAck('room:join', {
        code,
        nickname: `Small ${index + 1}`,
        playerToken: `small-mafia-${index}`,
      })
    }
    expect(await host.emitWithAck('game:start', { gameId: 'mafia', tone: 'friends' })).toEqual({
      ok: false,
      error: 'Need at least 4 players',
    })
    expect(serverRooms.getRoom(code)?.game).toBeUndefined()
    expect(serverRooms.getRoom(code)?.players).toHaveLength(3)
  })

  it('rejects forged player tokens before lobby or active-Mafia mutation', async () => {
    const host = client()
    const { code } = await createRoom(host)
    const room = serverRooms.getRoom(code)!
    const invalidTokens: unknown[] = [undefined, '', '   ', 42]
    const forgedStates: RoomStateMsg[] = []
    const lobbyActivity = room.lastActivityAt
    for (const [index, token] of invalidTokens.entries()) {
      const forged = client()
      forged.on('room:state', (message) => forgedStates.push(message))
      expect(
        await forged.timeout(500).emitWithAck('room:join', {
          code,
          nickname: `Forged lobby ${index}`,
          playerToken: token as string,
        }),
      ).toEqual({ ok: false, error: 'Player token required' })
    }
    expect(room.players).toEqual([])
    expect(room.lastActivityAt).toBe(lobbyActivity)
    expect(forgedStates).toEqual([])

    const phones = Array.from({ length: 4 }, () => client())
    const joins = await Promise.all(
      phones.map((phone, index) =>
        phone.emitWithAck('room:join', {
          code,
          nickname: `Valid ${index + 1}`,
          playerToken: `valid-forged-check-${index}`,
        }),
      ),
    )
    const playerIds = joins.map((join) => {
      if (!join.ok) throw new Error(join.error)
      return join.playerId
    })
    const startedAtHost = nextGamePhase(host, 'night')
    expect(await host.emitWithAck('game:start', { gameId: 'mafia', tone: 'family' })).toEqual({
      ok: true,
    })
    await startedAtHost
    const activeActivity = room.lastActivityAt

    for (const [index, token] of invalidTokens.entries()) {
      const forged = client()
      forged.on('room:state', (message) => forgedStates.push(message))
      expect(
        await forged.timeout(500).emitWithAck('room:join', {
          code,
          nickname: `Forged active ${index}`,
          playerToken: token as string,
        }),
      ).toEqual({ ok: false, error: 'Player token required' })
    }
    expect(room.players).toHaveLength(4)
    expect(room.lastActivityAt).toBe(activeActivity)
    expect(forgedStates).toEqual([])

    const state = room.game?.state as MafiaState
    const mafiaIndex = playerIds.findIndex((playerId) => state.roles[playerId] === 'mafia')
    const victimId = playerIds.find((playerId) => state.roles[playerId] !== 'mafia')!
    const reconnect = client()
    expect(
      await reconnect.emitWithAck('room:join', {
        code,
        nickname: 'Ignored valid reconnect rename',
        playerToken: `valid-forged-check-${mafiaIndex}`,
      }),
    ).toMatchObject({ ok: true, playerId: playerIds[mafiaIndex] })

    const actionAtHost = nextState(host, (message) => {
      const view = message.game?.view as { phase?: string; actionsDone?: number } | undefined
      return view?.phase === 'night' && view.actionsDone === 1
    })
    expect(await reconnect.emitWithAck('game:input', { input: { targetId: victimId } })).toEqual({
      ok: true,
      accepted: true,
    })
    expect((await actionAtHost).players).toHaveLength(4)
  })

  it('rejects malformed join payloads and nicknames without throwing or mutating the room', async () => {
    const host = client()
    const { code } = await createRoom(host)
    const room = serverRooms.getRoom(code)!
    const activityBefore = room.lastActivityAt
    const malformedStates: RoomStateMsg[] = []
    const forged = client()
    forged.on('room:state', (message) => malformedStates.push(message))

    for (const payload of [undefined, null, 42] as unknown[]) {
      expect(
        await forged
          .timeout(500)
          .emitWithAck(
            'room:join',
            payload as { code: string; nickname: string; playerToken: string },
          ),
      ).toEqual({ ok: false, error: 'Invalid join request' })
    }
    for (const badCode of [undefined, '', '   ', 42] as unknown[]) {
      expect(
        await forged.timeout(500).emitWithAck('room:join', {
          code: badCode as string,
          nickname: 'Bad code',
          playerToken: 'valid-token-for-bad-code',
        }),
      ).toEqual({ ok: false, error: 'Room code required' })
    }
    for (const [index, nickname] of [undefined, 42, '   '].entries()) {
      expect(
        await forged.timeout(500).emitWithAck('room:join', {
          code,
          nickname: nickname as string,
          playerToken: `valid-token-bad-name-${index}`,
        }),
      ).toEqual({ ok: false, error: 'Nickname required' })
    }

    const noAck = client()
    const noAckStates: RoomStateMsg[] = []
    noAck.on('room:state', (message) => noAckStates.push(message))
    ;(
      noAck as unknown as {
        emit(event: 'room:join', payload: unknown): void
      }
    ).emit('room:join', {
      code,
      nickname: 'No ack seat',
      playerToken: 'valid-no-ack-token',
    })
    ;(
      noAck as unknown as {
        emit(event: 'room:join', payload: unknown, ack: unknown): void
      }
    ).emit(
      'room:join',
      {
        code,
        nickname: 'Non-function ack seat',
        playerToken: 'valid-non-function-ack-token',
      },
      42,
    )
    expect(
      await noAck.timeout(500).emitWithAck('room:join', {
        code: '',
        nickname: 'Ordering probe',
        playerToken: 'ordering-probe-token',
      }),
    ).toEqual({ ok: false, error: 'Room code required' })

    expect(room.players).toEqual([])
    expect(room.lastActivityAt).toBe(activityBefore)
    expect(malformedStates).toEqual([])
    expect(noAckStates).toEqual([])

    const phones = Array.from({ length: 4 }, () => client())
    const joins = await Promise.all(
      phones.map((phone, index) =>
        phone.emitWithAck('room:join', {
          code,
          nickname: `Boundary ${index + 1}`,
          playerToken: `boundary-valid-${index}`,
        }),
      ),
    )
    const playerIds = joins.map((join) => {
      if (!join.ok) throw new Error(join.error)
      return join.playerId
    })
    const startedAtHost = nextGamePhase(host, 'night')
    expect(await host.emitWithAck('game:start', { gameId: 'mafia', tone: 'family' })).toEqual({
      ok: true,
    })
    await startedAtHost
    const state = room.game?.state as MafiaState
    const mafiaIndex = playerIds.findIndex((playerId) => state.roles[playerId] === 'mafia')
    const mafiosoId = playerIds[mafiaIndex]
    const victimId = playerIds.find((playerId) => state.roles[playerId] !== 'mafia')!

    const offlineAtHost = nextState(host, (message) =>
      message.players.some((player) => player.id === mafiosoId && !player.connected),
    )
    phones[mafiaIndex].disconnect()
    await offlineAtHost
    const reconnect = client()
    expect(
      await reconnect.emitWithAck('room:join', {
        code,
        nickname: 42 as unknown as string,
        playerToken: `boundary-valid-${mafiaIndex}`,
      }),
    ).toMatchObject({ ok: true, playerId: mafiosoId })

    const actionAtHost = nextState(host, (message) => {
      const view = message.game?.view as { phase?: string; actionsDone?: number } | undefined
      return view?.phase === 'night' && view.actionsDone === 1
    })
    expect(await reconnect.emitWithAck('game:input', { input: { targetId: victimId } })).toEqual({
      ok: true,
      accepted: true,
    })
    expect((await actionAtHost).players).toHaveLength(4)
  })

  it('hosts Bluff Battle without leaking truth or authors before reveal', async () => {
    const host = client()
    const { code } = await createRoom(host)
    const phones = [client(), client(), client()]
    const joins = await Promise.all(
      phones.map((phone, index) =>
        phone.emitWithAck('room:join', {
          code,
          nickname: ['Ana', 'Ben', 'Cy'][index],
          playerToken: `bluff-tok-${index}`,
        }),
      ),
    )
    if (joins.some((join) => !join.ok)) throw new Error('Failed to seat Bluff Battle players')

    const bluffAtHost = nextGamePhase(host, 'bluff')
    const bluffAtPlayers = phones.map((phone) => nextGamePhase(phone, 'bluff'))
    const started = await host.emitWithAck('game:start', {
      gameId: 'bluff-battle',
      tone: 'family',
      rounds: 1,
    })
    expect(started).toEqual({ ok: true })
    const hostBluffView = (await bluffAtHost).game?.view as Record<string, unknown>
    const playerBluffViews = (await Promise.all(bluffAtPlayers)).map(
      (message) => message.game?.view as Record<string, unknown>,
    )
    expect(hostBluffView).toMatchObject({
      phase: 'bluff',
      submittedCount: 0,
      totalPlayers: 3,
    })
    expectExactKeys(hostBluffView, [
      'phase',
      'round',
      'totalRounds',
      'question',
      'submittedCount',
      'totalPlayers',
      'deadline',
    ])
    for (const view of playerBluffViews) {
      expectExactKeys(view, ['phase', 'round', 'totalRounds', 'question', 'submitted', 'deadline'])
    }

    const question = hostBluffView.question as string
    const truth = bluffFamilyAnswers[question]
    if (!truth) throw new Error(`Unexpected family question: ${question}`)
    const rejectedTruth = await phones[0].emitWithAck('game:input', { input: { text: truth } })
    expect(rejectedTruth).toEqual({ ok: true, accepted: false, reason: 'matches-truth' })

    expect(await phones[0].emitWithAck('game:input', { input: { text: 'A sparkle' } })).toEqual({
      ok: true,
      accepted: true,
    })
    expect(await phones[0].emitWithAck('game:input', { input: { text: 'A replacement' } })).toEqual(
      {
        ok: true,
        accepted: false,
      },
    )
    expect(await phones[0].emitWithAck('game:input', { input: { text: truth } })).toEqual({
      ok: true,
      accepted: false,
    })
    expect(await phones[1].emitWithAck('game:input', { input: { text: 'a sparkle' } })).toEqual({
      ok: true,
      accepted: true,
    })
    const votes = phones.map((phone) => nextGamePhase(phone, 'vote'))
    const voteAtHost = nextGamePhase(host, 'vote')
    expect(await phones[2].emitWithAck('game:input', { input: { text: 'A parade' } })).toEqual({
      ok: true,
      accepted: true,
    })

    const hostView = (await voteAtHost).game?.view as Record<string, unknown>
    const playerViews = await Promise.all(votes)
    expect(hostView).toMatchObject({ phase: 'vote', pickedCount: 0, totalPlayers: 3 })
    expectExactKeys(hostView, [
      'phase',
      'round',
      'totalRounds',
      'question',
      'options',
      'pickedCount',
      'totalPlayers',
      'deadline',
    ])
    for (const option of hostView.options as unknown[]) expectExactKeys(option, ['id', 'text'])

    const options = playerViews.map(
      (message) =>
        (
          message.game?.view as {
            options: Array<{ id: string; text: string; yours: boolean }>
          }
        ).options,
    )
    expect(options[0]).toHaveLength(3)
    expect(options[0].filter((option) => option.text.toLowerCase() === 'a sparkle')).toHaveLength(1)
    expect(options[0].find((option) => option.text.toLowerCase() === 'a sparkle')?.yours).toBe(true)
    expect(options[1].find((option) => option.text.toLowerCase() === 'a sparkle')?.yours).toBe(true)
    for (const message of playerViews) {
      const view = message.game?.view as Record<string, unknown>
      expectExactKeys(view, [
        'phase',
        'round',
        'totalRounds',
        'question',
        'options',
        'yourPick',
        'deadline',
      ])
      for (const option of view.options as unknown[])
        expectExactKeys(option, ['id', 'text', 'yours'])
    }

    const ownOption = options[0].find((option) => option.yours)
    if (!ownOption) throw new Error('Expected a merged bluff owned by Ana')
    const afterOwnPick = nextGamePhase(phones[0], 'vote')
    expect(
      await phones[0].emitWithAck('game:input', { input: { optionId: ownOption.id } }),
    ).toEqual({ ok: true, accepted: false })
    expect((await afterOwnPick).game?.view).toMatchObject({ yourPick: null })

    const firstPick = options[0].find((option) => !option.yours)!
    expect(
      await phones[0].emitWithAck('game:input', { input: { optionId: firstPick.id } }),
    ).toEqual({ ok: true, accepted: true })
    const secondPick = options[0].find((option) => !option.yours && option.id !== firstPick.id)!
    const afterOverwrite = nextGamePhase(phones[0], 'vote')
    expect(
      await phones[0].emitWithAck('game:input', { input: { optionId: secondPick.id } }),
    ).toEqual({ ok: true, accepted: false })
    expect((await afterOverwrite).game?.view).toMatchObject({ yourPick: firstPick.id })
  })
})
