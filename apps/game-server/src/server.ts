import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@hpg/shared'
import { logger } from './logger'
import { RoomManager } from './roomManager'

/** Per-connection bookkeeping so `disconnect` knows which seat to release. */
interface SocketData {
  roomCode?: string
  playerToken?: string
}

/**
 * Attaches the Socket.IO game server to an HTTP server.
 *
 * This layer only translates socket events into RoomManager calls and
 * broadcasts the resulting views — all room *rules* live in RoomManager,
 * which keeps them unit-testable without sockets.
 */
export function attachGameServer(httpServer: HttpServer, rooms = new RoomManager()) {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, { cors: { origin: process.env.CORS_ORIGIN ?? '*' } })

  io.on('connection', (socket) => {
    // Child logger: every line for this connection is traceable by socketId.
    const log = logger.child({ socketId: socket.id })
    log.info({ event: 'socket_connected' })

    socket.on('room:create', (ack) => {
      const room = rooms.createRoom()
      socket.data.roomCode = room.code
      void socket.join(room.code)
      log.info({ event: 'room_created', roomCode: room.code })
      ack({ code: room.code })
    })

    socket.on('room:watch', ({ code }, ack) => {
      const room = rooms.getRoom(code)
      if (!room) {
        log.warn({ event: 'watch_rejected', roomCode: code, reason: 'Room not found' })
        return ack({ ok: false, error: 'Room not found' })
      }
      socket.data.roomCode = room.code
      void socket.join(room.code)
      log.info({ event: 'room_watched', roomCode: room.code })
      ack({ ok: true, view: rooms.toView(room) })
    })

    socket.on('room:join', ({ code, nickname, playerToken }, ack) => {
      const result = rooms.join(code, nickname, playerToken)
      if ('error' in result) {
        log.warn({ event: 'join_rejected', roomCode: code, reason: result.error })
        return ack({ ok: false, error: result.error })
      }
      socket.data.roomCode = result.room.code
      socket.data.playerToken = playerToken
      void socket.join(result.room.code)
      log.info({
        event: 'player_joined',
        roomCode: result.room.code,
        playerId: result.player.id,
        nickname: result.player.nickname,
      })
      // Broadcast the new lobby state to the room *before* acking the joiner, so
      // the host's `room:state` is delivered ahead of the joiner's ack — otherwise
      // the joiner's ack microtask can outrun the host's broadcast macrotask and a
      // listener registered right after the ack would catch this join rather than
      // the next state change. Same event name, ack shape, and emit target either way.
      io.to(result.room.code).emit('room:state', rooms.toView(result.room))
      ack({ ok: true, playerId: result.player.id, view: rooms.toView(result.room) })
    })

    socket.on('disconnect', () => {
      const { roomCode, playerToken } = socket.data
      if (!roomCode || !playerToken) return
      const room = rooms.setConnected(roomCode, playerToken, false)
      if (!room) return
      const player = room.players.find((p) => p.token === playerToken)
      log.info({ event: 'player_disconnected', roomCode, playerId: player?.id })
      io.to(roomCode).emit('room:state', rooms.toView(room))
    })
  })

  return { io, rooms }
}
