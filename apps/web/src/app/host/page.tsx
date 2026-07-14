'use client'
import { useEffect, useState } from 'react'
import type { PackTone, RoomStateMsg, WyrHostView } from '@hpg/shared'
import { getSocket } from '@/lib/socket'
import { WyrHost } from '@/components/host/WyrHost'

const TONES: PackTone[] = ['family', 'friends', 'spicy']

/**
 * The host (TV) screen. Creates a room on mount, then renders one of two
 * states from the same server-driven `room:state` snapshot: the lobby
 * (room code, player pills, tone picker + start button) or the active
 * game (delegated to the game-specific `WyrHost` component). This page
 * owns socket wiring; the game components are pure renderers.
 */
export default function HostPage() {
  const [msg, setMsg] = useState<RoomStateMsg | null>(null)
  const [tone, setTone] = useState<PackTone>('friends')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const socket = getSocket()
    socket.emit('room:create', ({ code }) => setMsg({ code, phase: 'lobby', players: [] }))
    socket.on('room:state', setMsg)
    return () => {
      socket.off('room:state', setMsg)
    }
  }, [])

  function startGame() {
    // Spicy packs are adult-only: the host confirms once, for the room (spec: 18+ gate).
    if (tone === 'spicy' && !window.confirm('Spicy pack is 18+. Everyone in the room is an adult?'))
      return
    setError(null)
    getSocket().emit('game:start', { gameId: 'would-you-rather', tone }, (res) => {
      if (!res.ok) setError(res.error)
    })
  }

  if (!msg) return <main className="grid min-h-screen place-items-center">Creating room…</main>

  if (msg.phase === 'game' && msg.game) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 p-8 text-white">
        <WyrHost
          view={msg.game.view as WyrHostView}
          onAdvance={() => getSocket().emit('game:advance')}
          onEnd={() => getSocket().emit('game:end')}
        />
      </main>
    )
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
      <div className="space-y-6 text-center">
        <p className="text-xl text-slate-400">Join at {window.location.host}/join with code</p>
        <p
          className="font-mono text-8xl font-bold tracking-[0.3em]"
          data-testid="room-code"
        >
          {msg.code}
        </p>
        <ul className="flex flex-wrap justify-center gap-3">
          {msg.players.map((p) => (
            <li
              key={p.id}
              className={`rounded-full px-4 py-2 text-lg ${p.connected ? 'bg-emerald-600' : 'bg-slate-700 line-through'}`}
            >
              {p.nickname}
            </li>
          ))}
        </ul>
        {msg.players.length === 0 ? (
          <p className="text-slate-500">Waiting for players…</p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`rounded-full px-4 py-2 capitalize ${tone === t ? 'bg-indigo-600' : 'bg-slate-800'}`}
                >
                  {t}
                  {t === 'spicy' && ' 🔞'}
                </button>
              ))}
            </div>
            <button
              onClick={startGame}
              className="rounded-lg bg-emerald-600 px-8 py-4 text-xl font-bold"
            >
              Start Would You Rather
            </button>
            {error && <p className="text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </main>
  )
}
