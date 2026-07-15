import { createServer } from 'node:http'
import { RoomManager } from './roomManager'
import { createHealthHandler } from './health'
import { logger } from './logger'
import { attachGameServer } from './server'

/** Rooms idle longer than this are deleted; any join/disconnect resets the clock. */
const ROOM_IDLE_MS = 60 * 60_000
/** Lobbies nobody ever joined die sooner — they're usually abandoned create-clicks. */
const EMPTY_LOBBY_IDLE_MS = 30 * 60_000
const SWEEP_INTERVAL_MS = 60_000
/** How long a shutdown waits for sockets to drain before force-exiting. */
const SHUTDOWN_TIMEOUT_MS = 10_000
const port = Number(process.env.PORT ?? 4000)

if (process.env.NODE_ENV === 'production' && !process.env.CORS_ORIGIN) {
  logger.warn({
    event: 'cors_origin_missing',
    msg: 'CORS_ORIGIN is unset in production — all cross-origin clients are blocked',
  })
}

// Rooms are constructed first so the health handler can be installed as the
// server's request listener BEFORE Socket.IO attaches — engine.io wraps
// whatever listeners exist at attach time and forwards non-/socket.io paths.
const rooms = new RoomManager()
const httpServer = createServer(createHealthHandler(rooms))
const { io, timers } = attachGameServer(httpServer, rooms)

const sweepInterval = setInterval(() => {
  const expired = rooms.sweepExpired(ROOM_IDLE_MS, EMPTY_LOBBY_IDLE_MS)
  if (expired.length === 0) return
  logger.info({ event: 'rooms_expired', roomCodes: expired })
  for (const code of expired) {
    // Clear the timer first so a firing setTimeout can't chase a swept room.
    timers.clear(code)
    io.in(code).disconnectSockets()
  }
}, SWEEP_INTERVAL_MS)

// Last-resort safety net: log the failure as structured JSON, then exit so
// the platform restarts us into a known-good state. Never try to keep serving
// after an unknown exception — game state may be corrupt.
process.on('uncaughtException', (err) => {
  logger.fatal({ event: 'uncaught_exception', err }, err.message)
  process.exit(1)
})
process.on('unhandledRejection', (reason) => {
  logger.fatal({ event: 'unhandled_rejection', err: reason }, String(reason))
  process.exit(1)
})

/** Stop accepting work, close every socket, and exit; force-exits after a timeout. */
function shutdown(signal: string): void {
  logger.info({ event: 'shutdown_started', signal })
  clearInterval(sweepInterval)
  // io.close() also closes the HTTP server it is attached to.
  void io.close(() => {
    logger.info({ event: 'shutdown_complete' })
    process.exit(0)
  })
  setTimeout(() => {
    logger.error({ event: 'shutdown_forced' })
    process.exit(1)
  }, SHUTDOWN_TIMEOUT_MS).unref()
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

httpServer.listen(port, () => {
  logger.info({ event: 'server_started', port })
})
