import { createServer } from 'node:http'
import { logger } from './logger'
import { attachGameServer } from './server'

/** Rooms idle longer than this are deleted; any join/disconnect resets the clock. */
const ROOM_IDLE_MS = 60 * 60_000
/** Lobbies nobody ever joined die sooner — they're usually abandoned create-clicks. */
const EMPTY_LOBBY_IDLE_MS = 30 * 60_000
const SWEEP_INTERVAL_MS = 60_000
const port = Number(process.env.PORT ?? 4000)

if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  logger.warn({
    event: 'cors_origin_missing',
    msg: 'CORS_ORIGIN is unset in production — all cross-origin clients are blocked',
  })
}

const httpServer = createServer()
const { io, rooms, timers } = attachGameServer(httpServer)

setInterval(() => {
  const expired = rooms.sweepExpired(ROOM_IDLE_MS, EMPTY_LOBBY_IDLE_MS)
  if (expired.length === 0) return
  logger.info({ event: 'rooms_expired', roomCodes: expired })
  for (const code of expired) {
    // Clear the timer first so a firing setTimeout can't chase a swept room.
    timers.clear(code)
    io.in(code).disconnectSockets()
  }
}, SWEEP_INTERVAL_MS)

httpServer.listen(port, () => {
  logger.info({ event: 'server_started', port })
})
