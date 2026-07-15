'use client'
import type { GameSocket } from './socket'

/**
 * Call `handler` every time the shared socket re-establishes its connection
 * after a drop. Socket.IO restores the transport automatically, but the
 * server's per-connection seat data (`socket.data`) starts empty on the new
 * connection — pages use this to re-emit `room:join` / `room:watch` and
 * reclaim their seat.
 *
 * @returns Cleanup that detaches the listener (for React effect teardown).
 */
export function onReconnect(socket: GameSocket, handler: () => void): () => void {
  socket.io.on('reconnect', handler)
  return () => {
    socket.io.off('reconnect', handler)
  }
}

/**
 * Call `handler(connected)` whenever the socket's transport drops or comes
 * back, so pages can show a "Reconnecting…" indicator.
 *
 * @returns Cleanup that detaches both listeners.
 */
export function onConnectionChange(
  socket: GameSocket,
  handler: (connected: boolean) => void,
): () => void {
  const up = () => handler(true)
  const down = () => handler(false)
  socket.on('connect', up)
  socket.on('disconnect', down)
  return () => {
    socket.off('connect', up)
    socket.off('disconnect', down)
  }
}
