'use client'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@hpg/shared'

/**
 * The application's typed Socket.IO client. Parameterised with the protocol's
 * server-to-client and client-to-server event maps so both `.on()` listeners
 * and `.emit()` calls are checked against `@hpg/shared` at compile time.
 */
export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: GameSocket | null = null

/**
 * Return the shared, lazily-created socket connection — one per browser tab.
 *
 * The instance is memoised in module scope so every component that calls this
 * reuses a single connection rather than opening a new one. The server URL is
 * read from `NEXT_PUBLIC_GAME_SERVER_URL`, falling back to the local dev
 * server at `http://localhost:4000` when the env var is unset.
 */
export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? 'http://localhost:4000', {
      transports: ['websocket'],
    })
  }
  return socket
}

/** Stable per-device identity; lets a reloaded/reconnected phone reclaim its seat. */
export function getPlayerToken(): string {
  const KEY = 'hpg:playerToken'
  let token = localStorage.getItem(KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(KEY, token)
  }
  return token
}
