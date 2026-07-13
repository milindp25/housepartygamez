import { createServer, type Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { io as connect, type Socket } from 'socket.io-client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ClientToServerEvents, JoinResult, RoomView, ServerToClientEvents } from '@hpg/shared'
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

function nextState(c: Client): Promise<RoomView> {
  return new Promise((resolve) => c.once('room:state', resolve))
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
