import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { io as connect } from 'socket.io-client'
import { describe, expect, it } from 'vitest'
import { createHealthHandler } from './health'
import { RoomManager } from './roomManager'
import { attachGameServer } from './server'

describe('health endpoint', () => {
  it('serves /health with the live room count, 404s other paths, and coexists with Socket.IO', async () => {
    const rooms = new RoomManager()
    const httpServer = createServer(createHealthHandler(rooms))
    attachGameServer(httpServer, rooms)
    await new Promise<void>((resolve) => httpServer.listen(0, resolve))
    const port = (httpServer.address() as AddressInfo).port
    const client = connect(`http://localhost:${port}`, { transports: ['websocket'] })
    try {
      const empty = await fetch(`http://localhost:${port}/health`)
      expect(empty.status).toBe(200)
      expect(await empty.json()).toEqual({ status: 'ok', rooms: 0 })

      // Socket.IO still owns its own path when a request handler is present.
      const created = await client.emitWithAck('room:create')
      expect(created.ok).toBe(true)

      const one = await fetch(`http://localhost:${port}/health`)
      expect(await one.json()).toEqual({ status: 'ok', rooms: 1 })

      const miss = await fetch(`http://localhost:${port}/nope`)
      expect(miss.status).toBe(404)
    } finally {
      client.disconnect()
      await new Promise<void>((resolve) => httpServer.close(() => resolve()))
    }
  })
})
