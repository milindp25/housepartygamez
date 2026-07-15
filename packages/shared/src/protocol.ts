import type { GameId, GameInputRejectionReason } from './engine/types'
import type { PackTone } from './engine/content'

/**
 * A single player's public presence in a room. Contains no secrets, so it is
 * safe to broadcast to every connected client.
 */
export interface PlayerInfo {
  id: string
  nickname: string
  connected: boolean
}

/**
 * The per-recipient room snapshot.
 *
 * When a game is running, `game.view` is PERSONALIZED (`hostView` for host
 * screens, `playerView` for players) — so two sockets in the same room
 * receive different `RoomStateMsg` payloads. This is the info-hiding
 * mechanism every hidden-information game (Imposter, Mafia, Bluff Battle)
 * relies on.
 */
export interface RoomStateMsg {
  code: string
  phase: 'lobby' | 'game'
  players: PlayerInfo[]
  game?: { id: GameId; view: unknown }
}

/**
 * Acknowledgement returned to a client that attempted to join a room. The
 * discriminated `ok` flag lets callers narrow to either the seated player's
 * identity and view or a human-readable failure reason.
 */
export type JoinResult =
  { ok: true; playerId: string; view: RoomStateMsg } | { ok: false; error: string }

/**
 * Acknowledgement returned to a host screen that created a room. On success it
 * carries the room's `hostToken` — the per-room secret that `room:watch` must
 * present to (re)gain host powers. Creation can fail when the server is at
 * its room cap.
 */
export type CreateRoomResult =
  { ok: true; code: string; hostToken: string } | { ok: false; error: string }

/**
 * Acknowledgement returned to a host screen that attempted to open a room's
 * public view. The discriminated `ok` flag narrows to either the current view
 * or a human-readable failure reason.
 */
export type WatchResult = { ok: true; view: RoomStateMsg } | { ok: false; error: string }

/**
 * Acknowledgement returned when starting a game, including business-rule
 * failures such as an undersized lobby or unknown content pack.
 */
export type StartGameResult = { ok: true } | { ok: false; error: string }

/**
 * Action-correlated acknowledgement for one `game:input`. `accepted` reports
 * whether the reducer changed authoritative state; a safe optional reason lets
 * a game explain a rejection without placing secret data in room snapshots.
 */
export type GameInputResult =
  | { ok: true; accepted: true }
  | { ok: true; accepted: false; reason?: GameInputRejectionReason }
  | { ok: false; error: string }

/**
 * Events a client may emit to the server, keyed by event name. Each value is
 * the emitter signature Socket.IO enforces, including the acknowledgement
 * callback shape for request/response round-trips.
 */
export interface ClientToServerEvents {
  /** Host screen creates a room; the ack carries the room's host secret. */
  'room:create': (ack: (res: CreateRoomResult) => void) => void
  /** Host screen (re)opens an existing room's view; requires the room's host secret. */
  'room:watch': (
    payload: { code: string; hostToken: string },
    ack: (res: WatchResult) => void,
  ) => void
  /** Player joins (or reconnects — same playerToken restores the seat). */
  'room:join': (
    payload: { code: string; nickname: string; playerToken: string },
    ack: (res: JoinResult) => void,
  ) => void
  /** Host starts a game for the current lobby, drawing prompts from a tone-tier pack. */
  'game:start': (
    payload: { gameId: GameId; tone: PackTone; rounds?: number },
    ack: (res: StartGameResult) => void,
  ) => void
  /** A player submits input; the acknowledgement is correlated to this exact reducer action. */
  'game:input': (payload: { input: unknown }, ack: (res: GameInputResult) => void) => void
  /** Host skips ahead — e.g. everyone's done reading the reveal. */
  'game:advance': () => void
  /** Host ends the game and returns the room to the lobby. */
  'game:end': () => void
}

/**
 * Events the server may push to connected clients, keyed by event name. Each
 * value is the listener signature Socket.IO enforces on the receiving side.
 */
export interface ServerToClientEvents {
  /**
   * Broadcast the room's current snapshot whenever it changes. The payload is
   * personalized per socket during game phases (see {@link RoomStateMsg}).
   */
  'room:state': (msg: RoomStateMsg) => void
}
