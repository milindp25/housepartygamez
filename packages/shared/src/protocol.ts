/**
 * A single player's public presence in a room. Contains no secrets, so it is
 * safe to broadcast to every connected client.
 */
export interface PlayerInfo {
  id: string
  nickname: string
  connected: boolean
}

/** What every client renders. Lobby has no secrets, so one view for all. */
export interface RoomView {
  code: string
  phase: 'lobby'
  players: PlayerInfo[]
}

/**
 * Acknowledgement returned to a client that attempted to join a room. The
 * discriminated `ok` flag lets callers narrow to either the seated player's
 * identity and view or a human-readable failure reason.
 */
export type JoinResult =
  { ok: true; playerId: string; view: RoomView } | { ok: false; error: string }

/**
 * Acknowledgement returned to a host screen that attempted to open a room's
 * public view. The discriminated `ok` flag narrows to either the current view
 * or a human-readable failure reason.
 */
export type WatchResult = { ok: true; view: RoomView } | { ok: false; error: string }

/**
 * Events a client may emit to the server, keyed by event name. Each value is
 * the emitter signature Socket.IO enforces, including the acknowledgement
 * callback shape for request/response round-trips.
 */
export interface ClientToServerEvents {
  /** Host screen creates a room. */
  'room:create': (ack: (res: { code: string }) => void) => void
  /** Host screen (re)opens an existing room's public view. */
  'room:watch': (payload: { code: string }, ack: (res: WatchResult) => void) => void
  /** Player joins (or reconnects — same playerToken restores the seat). */
  'room:join': (
    payload: { code: string; nickname: string; playerToken: string },
    ack: (res: JoinResult) => void,
  ) => void
}

/**
 * Events the server may push to connected clients, keyed by event name. Each
 * value is the listener signature Socket.IO enforces on the receiving side.
 */
export interface ServerToClientEvents {
  /** Broadcast the room's current public view whenever it changes. */
  'room:state': (view: RoomView) => void
}
