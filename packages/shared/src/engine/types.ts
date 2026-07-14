/**
 * Every game the platform knows about (spec catalog; only some are built so
 * far). The union is closed here so `RoomStateMsg.game.id` and the server's
 * definition registry stay exhaustive across the codebase.
 */
export type GameId =
  | 'would-you-rather'
  | 'most-likely-to'
  | 'never-have-i-ever'
  | 'who-said-that'
  | 'imposter'
  | 'bluff-battle'
  | 'mafia'

/**
 * A seated participant as the engine sees them. This is deliberately a subset
 * of the room-manager's `RoomPlayer` (no device `token`), so game reducers
 * cannot correlate players back to their sockets.
 */
export interface GamePlayer {
  id: string
  nickname: string
  connected: boolean
}

/**
 * Everything that can change a game's state. Reducers are pure: same
 * `state + action` always produces the same next state. `now` is passed in
 * (never read from `Date.now` inside a reducer) so tests control time and
 * replays are deterministic.
 */
export type GameAction =
  | { type: 'PLAYER_INPUT'; playerId: string; input: unknown; now: number }
  | { type: 'TIMER_EXPIRED'; now: number }
  | { type: 'HOST_ADVANCE'; now: number }

/**
 * Every game state exposes `deadline` (epoch ms, or `null` when waiting on
 * the host). The server watches it and dispatches `TIMER_EXPIRED` when it
 * passes — reducers never own timers, which keeps them pure and testable.
 */
export interface TimedState {
  deadline: number | null
}

/**
 * A game is data + pure functions. The server hosts definitions generically:
 * it never contains game rules, and clients only ever see view objects.
 *
 * `playerView` is the info-hiding boundary — a player's socket receives
 * exactly what that player may see, nothing more. This is what makes
 * hidden-information games (Imposter, Mafia, Bluff Battle) possible without
 * leaking through the wire.
 */
export interface GameDefinition<State extends TimedState, Settings, Prompt> {
  id: GameId
  minPlayers: number
  /**
   * Per-game upper bound; when set, `startGame` rejects larger lobbies. The
   * room-wide entitlement cap (managed by RoomManager / plan 4) still applies
   * in addition to this.
   */
  maxPlayers?: number
  defaultSettings: Settings
  init(args: { players: GamePlayer[]; prompts: Prompt[]; settings: Settings; now: number }): State
  reducer(state: State, action: GameAction): State
  playerView(state: State, playerId: string): unknown
  hostView(state: State): unknown
  isFinished(state: State): boolean
}

/**
 * Type-erased definition for generic storage. `RoomManager` treats every game
 * uniformly through this alias; concrete generic parameters are enforced at
 * each game's module boundary (its own `.ts` file), so no type safety is lost
 * at the point it matters.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameDefinition = GameDefinition<any, any, any>
