'use client'
import { useEffect, useState } from 'react'
import type { RoomView } from '@hpg/shared'
import { getSocket } from '@/lib/socket'

/**
 * The host (TV) screen. On mount it asks the server to create a fresh room and
 * then renders the room code big enough to read across the room, plus a live
 * grid of player pills. The pills update in place from every `room:state`
 * broadcast, so joins, disconnects, and reconnects appear without a refresh.
 */
export default function HostPage() {
  const [view, setView] = useState<RoomView | null>(null)

  useEffect(() => {
    const socket = getSocket()
    socket.emit('room:create', ({ code }) => {
      setView({ code, phase: 'lobby', players: [] })
    })
    socket.on('room:state', setView)
    return () => {
      socket.off('room:state', setView)
    }
  }, [])

  if (!view) return <main className="grid min-h-screen place-items-center">Creating room…</main>

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
      <div className="text-center">
        <p className="text-xl text-slate-400">
          Join at {typeof window !== 'undefined' ? window.location.host : ''}/join with code
        </p>
        <p className="my-6 font-mono text-8xl font-bold tracking-[0.3em]">{view.code}</p>
        <ul className="flex flex-wrap justify-center gap-3">
          {view.players.map((p) => (
            <li
              key={p.id}
              className={`rounded-full px-4 py-2 text-lg ${p.connected ? 'bg-emerald-600' : 'bg-slate-700 line-through'}`}
            >
              {p.nickname}
            </li>
          ))}
        </ul>
        {view.players.length === 0 && <p className="text-slate-500">Waiting for players…</p>}
      </div>
    </main>
  )
}
