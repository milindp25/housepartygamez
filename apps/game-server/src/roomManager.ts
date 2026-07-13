import { generateRoomCode, type RoomView } from '@hpg/shared'

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
 * The authoritative server state for a single room. `lastActivityAt` is bumped on
 * every interaction so idle rooms can be swept; see {@link RoomManager.sweepExpired}.
 */
export interface Room {
  code: string
  players: RoomPlayer[]
  lastActivityAt: number
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
   * socket. New players must supply a non-blank, unique nickname and the room
   * must have space.
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
    room.lastActivityAt = this.now()

    const existing = room.players.find((p) => p.token === token)
    if (existing) {
      existing.connected = true
      return { room, player: existing }
    }

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
   * Flip a player's connection flag (e.g. on socket disconnect/reconnect) and
   * bump room activity so a room with a briefly-dropped player is not swept.
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
    player.connected = connected
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
   * Project a room to the public {@link RoomView} broadcast to clients, stripping
   * private fields (notably each player's `token`).
   *
   * @param room - The room to project.
   * @returns The client-safe view of the room.
   */
  toView(room: Room): RoomView {
    return {
      code: room.code,
      phase: 'lobby',
      players: room.players.map(({ id, nickname, connected }) => ({ id, nickname, connected })),
    }
  }
}
