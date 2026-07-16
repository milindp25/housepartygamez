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
import { RateLimiter } from './rateLimiter'
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
 * Runtime shape check for client payloads. Socket.IO types are compile-time
 * only — a hostile client can send anything, and a thrown destructure inside
 * a handler is an uncaught exception that kills the whole process.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
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

/** Upper bound for a client-requested round count; keeps settings sane. */
const MAX_ROUNDS = 50

/**
 * Resolve the Socket.IO CORS origin. An explicit CORS_ORIGIN always wins.
 * Production with no explicit origin fails CLOSED (`false` = block all
 * cross-origin requests) rather than open — a misconfigured deploy should be
 * unreachable, not world-writable. Dev/test keep `'*'` so localhost:3000 can
 * reach localhost:4000.
 */
export function resolveCorsOrigin(env: {
  CORS_ORIGIN?: string
  NODE_ENV?: string
}): string | false {
  if (env.CORS_ORIGIN) return env.CORS_ORIGIN
  return env.NODE_ENV === 'production' ? false : '*'
}

/**
 * Attaches the Socket.IO game server to an HTTP server.
 *
 * This layer only translates socket events into RoomManager calls and
 * broadcasts the resulting personalized views — all room and game *rules*
 * live in RoomManager and the pure game definitions, which keeps them
 * unit-testable without sockets.
 */
export function attachGameServer(
  httpServer: HttpServer,
  rooms = new RoomManager(),
  opts: {
    maxRooms?: number
    /** Per-IP budget for `room:create`. Guards the global room cap from being
     * exhausted by one script in milliseconds, locking out every real host. */
    roomCreateLimit?: { max: number; windowMs: number }
    /** Per-IP budget for `room:join` attempts (successful or not). Room codes
     * are only a 4-letter, 24-symbol alphabet (331,776 combinations) — with no
     * limit here, an attacker can brute-force any live room's code and join
     * it as an uninvited player in well under a second. */
    joinAttemptLimit?: { max: number; windowMs: number }
  } = {},
) {
  const maxRooms = opts.maxRooms ?? 500
  const roomCreateLimiter = new RateLimiter(
    opts.roomCreateLimit ?? { max: 20, windowMs: 10 * 60_000 },
  )
  const joinAttemptLimiter = new RateLimiter(opts.joinAttemptLimit ?? { max: 30, windowMs: 60_000 })
  const io = new Server<
    ClientToServerEvents,
    ServerToClientEvents,
    Record<string, never>,
    SocketData
  >(httpServer, { cors: { origin: resolveCorsOrigin(process.env) } })
  const timers = new RoomTimers()

  /** Best-effort client identity for rate limiting. Not spoof-proof behind a
   * misconfigured proxy, but matches what `socket.handshake.address` gives us
   * with no additional infra — a real improvement over no limit at all. */
  function clientKey(socket: { handshake: { address: string } }): string {
    return socket.handshake.address
  }

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
      if (typeof ack !== 'function') {
        log.warn({ event: 'room_create_rejected', reason: 'missing acknowledgement' })
        return
      }
      if (!roomCreateLimiter.attempt(clientKey(socket))) {
        log.warn({ event: 'room_create_rejected', reason: 'rate limited' })
        return ack({ ok: false, error: 'Too many rooms created — try again in a few minutes' })
      }
      if (rooms.roomCount >= maxRooms) {
        log.warn({
          event: 'room_create_rejected',
          reason: 'server full',
          roomCount: rooms.roomCount,
        })
        return ack({ ok: false, error: 'Server is busy — try again in a few minutes' })
      }
      const room = rooms.createRoom()
      socket.data.roomCode = room.code
      socket.data.role = 'host'
      void socket.join(room.code)
      log.info({ event: 'room_created', roomCode: room.code })
      ack({ ok: true, code: room.code, hostToken: room.hostToken })
    })

    socket.on('room:watch', (payload, ack) => {
      if (typeof ack !== 'function') {
        log.warn({ event: 'watch_rejected', reason: 'missing acknowledgement' })
        return
      }
      if (
        !isRecord(payload) ||
        typeof payload.code !== 'string' ||
        !payload.code.trim() ||
        typeof payload.hostToken !== 'string'
      ) {
        log.warn({ event: 'watch_rejected', reason: 'invalid request' })
        return ack({ ok: false, error: 'Invalid watch request' })
      }
      const room = rooms.getRoom(payload.code)
      // Deliberately the same error for "no such room" and "wrong token" so a code
      // scanner can't distinguish live rooms from dead ones.
      if (!room || room.hostToken !== payload.hostToken) {
        log.warn({ event: 'watch_rejected', roomCode: payload.code, reason: 'not authorized' })
        return ack({ ok: false, error: 'Room not found' })
      }
      socket.data.roomCode = room.code
      socket.data.role = 'host'
      void socket.join(room.code)
      log.info({ event: 'room_watched', roomCode: room.code })
      ack({ ok: true, view: rooms.toHostState(room) })
    })

    socket.on('room:join', (payload, ack) => {
      if (typeof ack !== 'function') {
        log.warn({ event: 'join_rejected', reason: 'missing acknowledgement' })
        return
      }
      if (!joinAttemptLimiter.attempt(clientKey(socket))) {
        log.warn({ event: 'join_rejected', reason: 'rate limited' })
        return ack({ ok: false, error: 'Too many attempts — try again in a minute' })
      }
      if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
        log.warn({ event: 'join_rejected', reason: 'invalid request' })
        return ack({ ok: false, error: 'Invalid join request' })
      }
      const request = payload as unknown as Record<string, unknown>
      const { code } = request
      if (typeof code !== 'string' || !code.trim()) {
        log.warn({ event: 'join_rejected', reason: 'room code required' })
        return ack({ ok: false, error: 'Room code required' })
      }
      const nickname = request.nickname
      const playerToken = request.playerToken
      const result = rooms.join(code, nickname, playerToken)
      if ('error' in result) {
        log.warn({ event: 'join_rejected', roomCode: code, reason: result.error })
        return ack({ ok: false, error: result.error })
      }
      socket.data.roomCode = result.room.code
      socket.data.playerToken = result.player.token
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
      const playerMsg = rooms.toPlayerState(result.room, result.player.token)
      if (playerMsg) ack({ ok: true, playerId: result.player.id, view: playerMsg })
    })

    socket.on('game:start', (payload, ack) => {
      if (typeof ack !== 'function') {
        log.warn({ event: 'game_start_rejected', reason: 'missing acknowledgement' })
        return
      }
      const code = socket.data.roomCode
      if (!code) return ack({ ok: false, error: 'Not in a room' })
      if (socket.data.role !== 'host') {
        log.warn({ event: 'game_start_rejected', roomCode: code, reason: 'not host' })
        return ack({ ok: false, error: 'Only the host can start a game' })
      }
      // Compile-time, `payload` already has the protocol's shape — these checks
      // exist because a hostile client is not bound by our TypeScript types.
      if (
        !isRecord(payload) ||
        typeof payload.gameId !== 'string' ||
        typeof payload.tone !== 'string'
      ) {
        log.warn({ event: 'game_start_rejected', roomCode: code, reason: 'invalid request' })
        return ack({ ok: false, error: 'Invalid start request' })
      }
      const { gameId, tone, rounds } = payload
      if (
        rounds !== undefined &&
        (!Number.isInteger(rounds) || (rounds as number) < 1 || (rounds as number) > MAX_ROUNDS)
      ) {
        log.warn({ event: 'game_start_rejected', roomCode: code, reason: 'invalid rounds', rounds })
        return ack({ ok: false, error: 'Invalid rounds' })
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
      const settings = {
        ...definition.defaultSettings,
        ...(rounds ? { rounds: rounds as number } : {}),
      }
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

    socket.on('game:input', (payload, ack) => {
      if (typeof ack !== 'function') {
        log.warn({ event: 'game_input_rejected', reason: 'missing acknowledgement' })
        return
      }
      if (!isRecord(payload)) {
        log.warn({ event: 'game_input_rejected', reason: 'invalid request' })
        return ack({ ok: false, error: 'Invalid input request' })
      }
      const { input } = payload
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

  /** Drop rate-limit entries for IPs with no recent attempts, so a long-lived
   * process doesn't accumulate one unbounded Map entry per distinct visitor. */
  function sweepRateLimiters(): void {
    roomCreateLimiter.sweep()
    joinAttemptLimiter.sweep()
  }

  return { io, rooms, timers, sweepRateLimiters }
}
