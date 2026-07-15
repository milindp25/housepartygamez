import type { IncomingMessage, ServerResponse } from 'node:http'
import type { RoomManager } from './roomManager'

/**
 * Minimal HTTP handler for platform health checks. Socket.IO intercepts its
 * own `/socket.io/*` path when attached; every other request lands here.
 * `/health` reports process liveness plus the live room count so a deploy
 * platform (and a human with curl) can see the server is up; anything else
 * gets a fast 404 instead of a connection left hanging.
 */
export function createHealthHandler(rooms: RoomManager) {
  return (req: IncomingMessage, res: ServerResponse): void => {
    if (req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({ status: 'ok', rooms: rooms.roomCount }))
      return
    }
    res.writeHead(404, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ error: 'not found' }))
  }
}
