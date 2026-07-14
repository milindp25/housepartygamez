import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import {
  bluffBattle,
  imposter,
  mafia,
  mostLikelyTo,
  neverHaveIEver,
  pickPrompts,
  whoSaidThat,
  wouldYouRather,
  type AnyGameDefinition,
  type ClientToServerEvents,
  type GameAction,
  type GameId,
  type ServerToClientEvents,
} from '@hpg/shared'
import { getPack } from '@hpg/content'
import { logger } from './logger'
import { RoomManager, type Room } from './roomManager'
import { RoomTimers } from './timers'

/**
 * Per-connection bookkeeping. `role` distinguishes host screens (which get
 * `hostView` payloads and can start/advance/end games) from player phones
 * (which get personalized `playerView` payloads and can submit input).
 */
interface SocketData {
  roomCode?: string
  playerToken?: string
  role?: 'host' | 'player'
}

/**
 * The set of game definitions the server knows how to host. Later plans
 * extend this map with the remaining games in the catalog.
 */
const definitions: Partial<Record<GameId, AnyGameDefinition>> = {
  'would-you-rather': wouldYouRather,
  'most-likely-to': mostLikelyTo,
  'never-have-i-ever': neverHaveIEver,
  'who-said-that': whoSaidThat,
  imposter,
  'bluff-battle': bluffBattle,
  mafia,
}

/**
 * Attaches the Socket.IO game server to an HTTP server.
 *
 * This layer only translates socket events into RoomManager calls and
 * broadcasts the resulting personalized views — all room and game *rules*
 * live in RoomManager and the pure game definitions, which keeps them
 * unit-testable without sockets.
 */
export function attachGameServer(httpServer: HttpServer, rooms = new RoomManager()) {
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, { cors: { origin: process.env.CORS_ORIGIN ?? '*' } })
  const timers = new RoomTimers()

  /**
   * Send every socket in the room ITS OWN personalized snapshot. Host
   * screens get `hostView`; each player phone gets that specific player's
   * `playerView`. This is the info-hiding boundary that makes hidden-info
   * games (Imposter, Mafia, Bluff Battle) possible over one shared channel.
   *
   * Runs synchronously against the local adapter (no `fetchSockets()`
   * round-trip) so every emit is queued in the same event-loop tick as the
   * caller's other side-effects. That gives the socket layer's ack-vs-
   * broadcast ordering the same guarantees as a plain `io.to(room).emit(...)`.
   */
  function broadcastRoom(room: Room): void {
    const socketIds = io.sockets.adapter.rooms.get(room.code)
    if (!socketIds) return
    for (const sid of socketIds) {
      const s = io.sockets.sockets.get(sid)
      if (!s) continue
      const msg =
        s.data.role === 'player' && s.data.playerToken
          ? rooms.toPlayerState(room, s.data.playerToken)
          : rooms.toHostState(room)
      if (msg) s.emit('room:state', msg)
    }
  }

  /** Re-arm the authoritative game deadline (or clear it in lobby), then broadcast one snapshot. */
  function synchronizeRoom(room: Room): void {
    if (room.game) {
      timers.reschedule(room.code, room.game.state.deadline, () =>
        dispatch(room.code, { type: 'TIMER_EXPIRED', now: Date.now() }),
      )
    } else {
      timers.clear(room.code)
    }
    broadcastRoom(room)
  }

  function hasOtherLivePlayerSocket(
    roomCode: string,
    playerToken: string,
    excludingSocketId: string,
  ): boolean {
    for (const candidate of io.sockets.sockets.values()) {
      if (candidate.id === excludingSocketId || !candidate.connected) continue
      if (
        candidate.data.role === 'player' &&
        candidate.data.roomCode === roomCode &&
        candidate.data.playerToken === playerToken
      ) {
        return true
      }
    }
    return false
  }

  /**
   * Run one action through the reducer, re-arm the timer against the new
   * deadline, and broadcast personalized snapshots. Silent no-op when the
   * game already ended between the event arriving and being dispatched.
   */
  function dispatch(code: string, action: GameAction): boolean {
    const previousState = rooms.getRoom(code)?.game?.state
    const room = rooms.applyGameAction(code, action)
    if (!room?.game) return false
    synchronizeRoom(room)
    return room.game.state !== previousState
  }

  io.on('connection', (socket) => {
    // Child logger: every line for this connection is traceable by socketId.
    const log = logger.child({ socketId: socket.id })
    log.info({ event: 'socket_connected' })

    socket.on('room:create', (ack) => {
      const room = rooms.createRoom()
      socket.data.roomCode = room.code
      socket.data.role = 'host'
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
      socket.data.role = 'host'
      void socket.join(room.code)
      log.info({ event: 'room_watched', roomCode: room.code })
      ack({ ok: true, view: rooms.toHostState(room) })
    })

    socket.on('room:join', ({ code, nickname, playerToken }, ack) => {
      const result = rooms.join(code, nickname, playerToken)
      if ('error' in result) {
        log.warn({ event: 'join_rejected', roomCode: code, reason: result.error })
        return ack({ ok: false, error: result.error })
      }
      socket.data.roomCode = result.room.code
      socket.data.playerToken = playerToken
      socket.data.role = 'player'
      void socket.join(result.room.code)
      log.info({
        event: 'player_joined',
        roomCode: result.room.code,
        playerId: result.player.id,
        nickname: result.player.nickname,
      })
      // Broadcast the new state to the room BEFORE acking the joiner. Both
      // broadcast and ack run in the same event-loop tick (broadcastRoom is
      // sync), so the host's `room:state` frame is queued ahead of the
      // joiner's ack response. Same event name, ack shape, and emit target
      // as before — only the intra-tick order matters. (Plan 1 deviations.)
      synchronizeRoom(result.room)
      const playerMsg = rooms.toPlayerState(result.room, playerToken)
      if (playerMsg) ack({ ok: true, playerId: result.player.id, view: playerMsg })
    })

    socket.on('game:start', ({ gameId, tone, rounds }, ack) => {
      const code = socket.data.roomCode
      if (!code) return ack({ ok: false, error: 'Not in a room' })
      if (socket.data.role !== 'host') {
        log.warn({ event: 'game_start_rejected', roomCode: code, reason: 'not host' })
        return ack({ ok: false, error: 'Only the host can start a game' })
      }
      const definition = definitions[gameId]
      const needsPack = gameId !== 'mafia'
      const pack = needsPack ? getPack(gameId, tone) : null
      if (!definition || (needsPack && !pack)) {
        log.warn({
          event: 'game_start_rejected',
          roomCode: code,
          reason: 'unknown game/pack',
          gameId,
          tone,
        })
        return ack({ ok: false, error: 'Unknown game or pack' })
      }
      const settings = { ...definition.defaultSettings, ...(rounds ? { rounds } : {}) }
      const prompts = needsPack ? pickPrompts(pack!, settings.rounds ?? pack!.prompts.length) : []
      const result = rooms.startGame(code, definition, prompts, settings)
      if ('error' in result) {
        log.warn({ event: 'game_start_rejected', roomCode: code, reason: result.error })
        return ack({ ok: false, error: result.error })
      }
      log.info({ event: 'game_started', roomCode: code, gameId, tone })
      // Same intra-tick ordering as room:join: broadcast first so the host's
      // "game started" `room:state` is queued ahead of the caller's ack response.
      synchronizeRoom(result.room)
      ack({ ok: true })
    })

    socket.on('game:input', ({ input }, ack) => {
      const { roomCode, playerToken } = socket.data
      const player =
        roomCode && playerToken ? rooms.playerByToken(roomCode, playerToken) : undefined
      if (!roomCode || !player) {
        log.warn({ event: 'game_input_rejected', reason: 'not seated' })
        return ack({ ok: false, error: 'Not seated in a game' })
      }
      const activeGame = rooms.getRoom(roomCode)?.game
      const reason = activeGame?.definition.inputRejection?.(activeGame.state, player.id, input)
      // Dispatch (sync broadcast) before ack so the resulting `room:state`
      // reaches every socket in the same tick, ahead of the caller's ack
      // response. `accepted` is correlated to this exact action, so unrelated
      // room broadcasts cannot be mistaken for its outcome.
      const accepted = dispatch(roomCode, {
        type: 'PLAYER_INPUT',
        playerId: player.id,
        input,
        now: Date.now(),
      })
      if (!accepted) {
        log.warn({
          event: 'game_input_not_applied',
          roomCode,
          playerId: player.id,
          reason: reason ?? 'invalid_input',
        })
      }
      ack(
        accepted
          ? { ok: true, accepted: true }
          : { ok: true, accepted: false, ...(reason && { reason }) },
      )
    })

    socket.on('game:advance', () => {
      const code = socket.data.roomCode
      if (code && socket.data.role === 'host') {
        log.info({ event: 'game_phase_advanced', roomCode: code })
        dispatch(code, { type: 'HOST_ADVANCE', now: Date.now() })
      }
    })

    socket.on('game:end', () => {
      const code = socket.data.roomCode
      if (!code || socket.data.role !== 'host') return
      const room = rooms.endGame(code)
      if (!room) return
      log.info({ event: 'game_ended', roomCode: code })
      synchronizeRoom(room)
    })

    socket.on('disconnect', () => {
      const { roomCode, playerToken, role } = socket.data
      if (role !== 'player' || !roomCode || !playerToken) return
      if (hasOtherLivePlayerSocket(roomCode, playerToken, socket.id)) {
        log.info({ event: 'player_socket_disconnected', roomCode, seatStillOnline: true })
        return
      }
      const room = rooms.setConnected(roomCode, playerToken, false)
      if (!room) return
      const player = room.players.find((p) => p.token === playerToken)
      log.info({ event: 'player_disconnected', roomCode, playerId: player?.id })
      synchronizeRoom(room)
    })
  })

  return { io, rooms, timers }
}
