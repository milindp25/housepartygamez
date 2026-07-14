'use client'
import { useEffect, useState } from 'react'
import type { GameId, PackTone, RoomStateMsg } from '@hpg/shared'
import { getSocket } from '@/lib/socket'
import { GameHost } from '@/components/host/GameHost'

const TONES: PackTone[] = ['family', 'friends', 'spicy']

/**
 * The catalog of games shown in the host picker. Not every entry has a
 * server-side definition yet (plans 3+ fill them in) — the server rejects
 * `game:start` for unknown games and the host sees "Unknown game or pack".
 */
const GAMES: Array<{ id: GameId; name: string }> = [
  { id: 'would-you-rather', name: 'Would You Rather' },
  { id: 'most-likely-to', name: 'Most Likely To' },
  { id: 'never-have-i-ever', name: 'Never Have I Ever' },
  { id: 'who-said-that', name: 'Who Said That?' },
]

/**
 * The host (TV) screen. Creates a room on mount, then renders either the
 * lobby (room code + player pills + game/tone pickers + start) or the
 * active game (delegated to `GameHost`, which dispatches on `game.id`).
 * All socket wiring lives here; renderer components are pure.
 */
export default function HostPage() {
  const [msg, setMsg] = useState<RoomStateMsg | null>(null)
  const [gameId, setGameId] = useState<GameId>('would-you-rather')
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
    getSocket().emit('game:start', { gameId, tone }, (res) => {
      if (!res.ok) setError(res.error)
    })
  }

  if (!msg) return <main className="grid min-h-screen place-items-center">Creating room…</main>

  if (msg.phase === 'game' && msg.game) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 p-8 text-white">
        <GameHost
          gameId={msg.game.id}
          view={msg.game.view}
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
          <div className="space-y-4">
            <div className="flex flex-wrap justify-center gap-2">
              {GAMES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setGameId(g.id)}
                  className={`rounded-full px-4 py-2 ${gameId === g.id ? 'bg-indigo-600' : 'bg-slate-800'}`}
                >
                  {g.name}
                </button>
              ))}
            </div>
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
              Start {GAMES.find((g) => g.id === gameId)?.name}
            </button>
            {error && <p className="text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </main>
  )
}
