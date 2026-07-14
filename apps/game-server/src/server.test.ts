import { createServer, type Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { io as connect, type Socket } from 'socket.io-client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type {
  ClientToServerEvents,
  JoinResult,
  RoomStateMsg,
  ServerToClientEvents,
} from '@hpg/shared'
import { attachGameServer } from './server'

type Client = Socket<ServerToClientEvents, ClientToServerEvents>

let httpServer: HttpServer
let url: string
const clients: Client[] = []

function client(): Client {
  const c: Client = connect(url, { transports: ['websocket'] })
  clients.push(c)
  return c
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

const bluffFamilyAnswers: Record<string, string> = {
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

beforeAll(async () => {
  httpServer = createServer()
  attachGameServer(httpServer)
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`
})

afterAll(async () => {
  for (const c of clients) c.disconnect()
  await new Promise<void>((resolve) => httpServer.close(() => resolve()))
})

describe('game server sockets', () => {
  it('host creates a room, player joins, everyone gets lobby state', async () => {
    const host = client()
    const { code } = await host.emitWithAck('room:create')
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
    const { code } = await host.emitWithAck('room:create')

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
    const { code } = await host.emitWithAck('room:create')
    const tv2 = client()
    const res = await tv2.emitWithAck('room:watch', { code })
    expect(res).toEqual({ ok: true, view: { code, phase: 'lobby', players: [] } })
  })
})

describe('game flow over sockets', () => {
  it('host starts WYR, players vote, reveal broadcasts, host ends game', async () => {
    const host = client()
    const { code } = await host.emitWithAck('room:create')
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
    const { code } = await host.emitWithAck('room:create')
    const p1 = client()
    await p1.emitWithAck('room:join', { code, nickname: 'Ana', playerToken: 'g-tok-3' })
    const res = await p1.emitWithAck('game:start', { gameId: 'would-you-rather', tone: 'friends' })
    expect(res).toEqual({ ok: false, error: 'Only the host can start a game' })
  })

  it('hosts Bluff Battle without leaking truth or authors before reveal', async () => {
    const host = client()
    const { code } = await host.emitWithAck('room:create')
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
