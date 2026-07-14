import {
  generateRoomCode,
  type AnyGameDefinition,
  type GameAction,
  type RoomStateMsg,
  type TimedState,
} from '@hpg/shared'

/**
 * A player's server-side seat in a room. Unlike the public `PlayerInfo` broadcast
 * to clients, this retains the private `token` used to recognise a returning
 * player and restore their original seat on reconnect.
 */
export interface RoomPlayer {
  id: string
  token: string
  nickname: string
  connected: boolean
}

/**
 * A game currently running in a room: the type-erased definition plus its
 * opaque reducer state. Keeping the game as an optional property on `Room`
 * (rather than a separate map) means room deletion and game cleanup are
 * inseparable — a swept room cannot leak a live game state or timer.
 */
export interface ActiveGame {
  definition: AnyGameDefinition
  state: TimedState
}

/**
 * The authoritative server state for a single room. `lastActivityAt` is bumped on
 * every interaction so idle rooms can be swept; see {@link RoomManager.sweepExpired}.
 * When `game` is set, the room is in the game phase; otherwise it is in the lobby.
 */
export interface Room {
  code: string
  players: RoomPlayer[]
  lastActivityAt: number
  game?: ActiveGame
}

const MAX_PLAYERS = 20

/**
 * In-memory registry of active rooms and the operations that mutate them:
 * creating rooms, joining/reconnecting players, tracking connection state, and
 * expiring idle rooms.
 *
 * `now` and `random` are injectable so tests can drive a deterministic clock and
 * RNG (asserting exact codes and precise expiry timing) while production defaults
 * to `Date.now` and `Math.random`.
 */
export class RoomManager {
  private rooms = new Map<string, Room>()
  private now: () => number
  private random: () => number
  private nextPlayerId = 1

  /**
   * @param opts.now - Clock source returning epoch milliseconds. Injectable for
   *   deterministic expiry tests; defaults to `Date.now`.
   * @param opts.random - RNG returning a value in [0, 1). Injectable so tests can
   *   force code collisions; defaults to `Math.random`.
   */
  constructor(opts: { now?: () => number; random?: () => number } = {}) {
    this.now = opts.now ?? Date.now
    this.random = opts.random ?? Math.random
  }

  /**
   * Create a new empty room with a unique code and register it.
   *
   * @returns The freshly created room.
   */
  createRoom(): Room {
    let code = generateRoomCode(this.random)
    while (this.rooms.has(code)) code = generateRoomCode(this.random) // avoid colliding with a live room
    const room: Room = { code, players: [], lastActivityAt: this.now() }
    this.rooms.set(code, room)
    return room
  }

  /**
   * Look up a room by code. Codes are stored uppercase, so lookups are
   * case-insensitive — players can type a code in any case.
   *
   * @param code - The room code, in any case.
   * @returns The room, or `undefined` if no such room exists.
   */
  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase())
  }

  /**
   * Join a room, or reconnect to an existing seat. A previously seated player is
   * recognised by `token` and restored to their original seat (preserving their
   * id) rather than taking a new one; this is how reconnects survive a dropped
   * socket. New seats are accepted only while the room is in its lobby; once
   * a game starts, its participant set is frozen. Lobby joins must supply a
   * non-blank, unique nickname and the room must have space.
   *
   * @param code - The room code, in any case.
   * @param nickname - Desired display name (trimmed); ignored on reconnect.
   * @param token - Stable per-client secret identifying the seat.
   * @returns The room and the seated player, or an `{ error }` describing why the
   *   join was rejected.
   */
  join(
    code: string,
    nickname: string,
    token: string,
  ): { room: Room; player: RoomPlayer } | { error: string } {
    const room = this.getRoom(code)
    if (!room) return { error: 'Room not found' }

    const existing = room.players.find((p) => p.token === token)
    if (existing) {
      room.lastActivityAt = this.now()
      this.updatePlayerConnection(room, existing, true)
      return { room, player: existing }
    }
    if (room.game) return { error: 'Game already running' }
    room.lastActivityAt = this.now()

    const name = nickname.trim()
    if (!name) return { error: 'Nickname required' }
    if (room.players.some((p) => p.nickname.toLowerCase() === name.toLowerCase())) {
      return { error: 'Nickname taken' }
    }
    if (room.players.length >= MAX_PLAYERS) return { error: 'Room full' }

    const player: RoomPlayer = {
      id: `p${this.nextPlayerId++}`,
      token,
      nickname: name,
      connected: true,
    }
    room.players.push(player)
    return { room, player }
  }

  /**
   * Flip a player's connection flag (e.g. on socket disconnect/reconnect),
   * propagate the change through an active game's reducer, and bump room
   * activity so a room with a briefly-dropped player is not swept.
   *
   * @param code - The room code, in any case.
   * @param token - The player's seat token.
   * @param connected - The new connection state.
   * @returns The room, or `undefined` if the room or player is unknown.
   */
  setConnected(code: string, token: string, connected: boolean): Room | undefined {
    const room = this.getRoom(code)
    const player = room?.players.find((p) => p.token === token)
    if (!room || !player) return undefined
    this.updatePlayerConnection(room, player, connected)
    room.lastActivityAt = this.now()
    return room
  }

  /**
   * Delete rooms whose idle time has exceeded their limit and return their codes.
   * Empty lobbies get a shorter leash (`emptyIdleMs`) than rooms someone actually joined.
   *
   * @param maxIdleMs - Idle limit for rooms that have at least one player.
   * @param emptyIdleMs - Idle limit for empty rooms; defaults to `maxIdleMs`.
   * @returns The codes of the rooms that were expired and removed.
   */
  sweepExpired(maxIdleMs: number, emptyIdleMs: number = maxIdleMs): string[] {
    const expired: string[] = []
    for (const [code, room] of this.rooms) {
      const limit = room.players.length === 0 ? emptyIdleMs : maxIdleMs
      if (this.now() - room.lastActivityAt > limit) {
        this.rooms.delete(code)
        expired.push(code)
      }
    }
    return expired
  }

  /**
   * Look up a seated player by their device token. Used by the socket layer
   * to map an incoming connection back to its game-side identity without
   * exposing tokens to game reducers.
   *
   * @param code - The room code, in any case.
   * @param token - The player's seat token.
   * @returns The matching player, or `undefined` if the room or seat is unknown.
   */
  playerByToken(code: string, token: string): RoomPlayer | undefined {
    return this.getRoom(code)?.players.find((p) => p.token === token)
  }

  /**
   * Start a game in this room using the given definition, prompt list, and
   * settings.
   *
   * Never throws: returns `{ error }` when the room is missing, a game is
   * already running, the lobby is under `minPlayers`, or the lobby exceeds
   * a game-specific `maxPlayers`. The socket layer forwards the error string
   * to the host as-is, so error text here is user-facing.
   *
   * @returns The room on success, or `{ error }` describing the rejection.
   */
  startGame(
    code: string,
    definition: AnyGameDefinition,
    prompts: unknown[],
    settings: unknown,
  ): { room: Room } | { error: string } {
    const room = this.getRoom(code)
    if (!room) return { error: 'Room not found' }
    if (room.game) return { error: 'Game already running' }
    const connectedPlayers = room.players.filter((player) => player.connected)
    if (connectedPlayers.length < definition.minPlayers) {
      return { error: `Need at least ${definition.minPlayers} players` }
    }
    if (definition.maxPlayers !== undefined && room.players.length > definition.maxPlayers) {
      return { error: `This game supports at most ${definition.maxPlayers} players` }
    }
    room.lastActivityAt = this.now()
    const players = room.players.map(({ id, nickname, connected }) => ({ id, nickname, connected }))
    room.game = {
      definition,
      state: definition.init({ players, prompts, settings, now: this.now() }),
    }
    return { room }
  }

  /**
   * Run one action through the active game's reducer. No-op (returns
   * `undefined`) when the room is unknown or no game is running — the socket
   * layer treats that as "silently drop", matching the reducer's own
   * silent-drop behavior for invalid inputs.
   *
   * @returns The room after the action, or `undefined` if there was nothing to do.
   */
  applyGameAction(code: string, action: GameAction): Room | undefined {
    const room = this.getRoom(code)
    if (!room?.game) return undefined
    room.lastActivityAt = this.now()
    room.game.state = room.game.definition.reducer(room.game.state, action)
    return room
  }

  /**
   * End the current game and return the room to the lobby (either because
   * the host clicked "Back to lobby" or a game finished naturally and the
   * server acknowledged it). Idempotent when no game is running.
   */
  endGame(code: string): Room | undefined {
    const room = this.getRoom(code)
    if (!room) return undefined
    room.lastActivityAt = this.now()
    delete room.game
    return room
  }

  private baseMsg(room: Room): Omit<RoomStateMsg, 'game' | 'phase'> {
    return {
      code: room.code,
      players: room.players.map(({ id, nickname, connected }) => ({ id, nickname, connected })),
    }
  }

  /**
   * Snapshot for host screens (TV): public info plus the definition's
   * `hostView`. Host views may include information (like a running
   * leaderboard) that individual player views must not.
   */
  toHostState(room: Room): RoomStateMsg {
    if (!room.game) return { ...this.baseMsg(room), phase: 'lobby' }
    return {
      ...this.baseMsg(room),
      phase: 'game',
      game: { id: room.game.definition.id, view: room.game.definition.hostView(room.game.state) },
    }
  }

  /**
   * Snapshot for one player's phone: public info plus THAT player's
   * `playerView` only. This is the info-hiding boundary; two players in the
   * same room may receive different payloads (e.g. Imposter's hidden word,
   * Mafia's role assignment).
   *
   * @returns `undefined` when the token doesn't match a seat in the room.
   */
  toPlayerState(room: Room, token: string): RoomStateMsg | undefined {
    const player = room.players.find((p) => p.token === token)
    if (!player) return undefined
    if (!room.game) return { ...this.baseMsg(room), phase: 'lobby' }
    return {
      ...this.baseMsg(room),
      phase: 'game',
      game: {
        id: room.game.definition.id,
        view: room.game.definition.playerView(room.game.state, player.id),
      },
    }
  }

  /**
   * Legacy lobby-only projection. Kept as a thin alias over `toHostState` so
   * Task 5's rename callers (`server.ts`) keep compiling until Task 7
   * rewires them to the personalized `toHostState`/`toPlayerState` pair.
   */
  toView(room: Room): RoomStateMsg {
    return this.toHostState(room)
  }

  private updatePlayerConnection(room: Room, player: RoomPlayer, connected: boolean): void {
    if (player.connected === connected) return
    player.connected = connected
    if (!room.game) return
    room.game.state = room.game.definition.reducer(room.game.state, {
      type: 'PLAYER_CONNECTION_CHANGED',
      playerId: player.id,
      connected,
      now: this.now(),
    })
  }
}
