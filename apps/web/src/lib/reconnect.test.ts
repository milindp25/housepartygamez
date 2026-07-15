import { describe, expect, it, vi } from 'vitest'
import { onConnectionChange, onReconnect } from './reconnect'
import type { GameSocket } from './socket'

type Handler = (...args: unknown[]) => void

/** Minimal on/off/fire event target standing in for a Socket.IO socket/manager. */
function fakeEmitter() {
  const listeners = new Map<string, Set<Handler>>()
  return {
    on(event: string, fn: Handler) {
      if (!listeners.has(event)) listeners.set(event, new Set())
      listeners.get(event)!.add(fn)
    },
    off(event: string, fn: Handler) {
      listeners.get(event)?.delete(fn)
    },
    fire(event: string, ...args: unknown[]) {
      for (const fn of listeners.get(event) ?? []) fn(...args)
    },
  }
}

describe('onConnectionChange', () => {
  it('reports drops and recoveries until cleaned up', () => {
    const socket = fakeEmitter()
    const seen: boolean[] = []
    const off = onConnectionChange(socket as unknown as GameSocket, (c) => seen.push(c))
    socket.fire('disconnect')
    socket.fire('connect')
    expect(seen).toEqual([false, true])
    off()
    socket.fire('disconnect')
    expect(seen).toEqual([false, true])
  })
})

describe('onReconnect', () => {
  it('fires only on manager reconnect events, until cleaned up', () => {
    const manager = fakeEmitter()
    const socket = { io: manager } as unknown as GameSocket
    const handler = vi.fn()
    const off = onReconnect(socket, handler)
    manager.fire('reconnect')
    expect(handler).toHaveBeenCalledTimes(1)
    off()
    manager.fire('reconnect')
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
