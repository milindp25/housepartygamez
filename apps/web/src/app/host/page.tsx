'use client'
import { useEffect, useState } from 'react'
import type { GameId, PackTone, RoomStateMsg } from '@hpg/shared'
import { QRCodeSVG } from 'qrcode.react'
import { track } from '@/lib/analytics'
import { buildJoinUrl } from '@/lib/join-url'
import { getSocket } from '@/lib/socket'
import { GameHost } from '@/components/host/GameHost'

const TONES: PackTone[] = ['family', 'friends', 'spicy']

/**
 * The catalog of games shown in the host picker. Not every entry has a
 * server-side definition yet (plans 3+ fill them in) — the server rejects
 * `game:start` for unknown games and the host sees "Unknown game or pack".
 */
const GAMES: Array<{ id: GameId; name: string; note?: string }> = [
  { id: 'would-you-rather', name: 'Would You Rather' },
  { id: 'most-likely-to', name: 'Most Likely To' },
  { id: 'never-have-i-ever', name: 'Never Have I Ever' },
  { id: 'who-said-that', name: 'Who Said That?' },
  { id: 'imposter', name: 'Imposter' },
  { id: 'bluff-battle', name: 'Bluff Battle' },
  { id: 'mafia', name: 'Mafia', note: '6–20 players' },
]

function getInitialGameId(): GameId {
  if (typeof window === 'undefined') return 'would-you-rather'
  const requestedGame = new URLSearchParams(window.location.search).get('game')
  return GAMES.find(({ id }) => id === requestedGame)?.id ?? 'would-you-rather'
}

/**
 * The host (TV) screen. Creates a room on mount, then renders either the
 * lobby (room code + player pills + game/tone pickers + start) or the
 * active game (delegated to `GameHost`, which dispatches on `game.id`).
 * All socket wiring lives here; renderer components are pure.
 */
export default function HostPage() {
  const [msg, setMsg] = useState<RoomStateMsg | null>(null)
  const [gameId, setGameId] = useState<GameId>(getInitialGameId)
  const [tone, setTone] = useState<PackTone>('friends')
  const [error, setError] = useState<string | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)

  useEffect(() => {
    const socket = getSocket()
    socket.emit('room:create', (res) => {
      if (!res.ok) {
        setFatal(res.error)
        return
      }
      // Session-scoped so a TV refresh can reclaim host powers via room:watch,
      // but the secret never persists across browser sessions.
      sessionStorage.setItem(`hpg:hostToken:${res.code}`, res.hostToken)
      setMsg({ code: res.code, phase: 'lobby', players: [] })
      track('room_created')
    })
    socket.on('room:state', setMsg)
    return () => {
      socket.off('room:state', setMsg)
    }
  }, [])

  function startGame() {
    // Spicy packs are adult-only: the host confirms once, for the room (spec: 18+ gate).
    if (
      gameId !== 'mafia' &&
      tone === 'spicy' &&
      !window.confirm('Spicy pack is 18+. Everyone in the room is an adult?')
    )
      return
    setError(null)
    getSocket().emit('game:start', { gameId, tone }, (res) => {
      if (!res.ok) {
        setError(res.error)
        return
      }
      track('game_started', { gameId, tone })
    })
  }

  if (fatal) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 p-8 text-white">
        <p className="text-xl text-red-400">{fatal}</p>
      </main>
    )
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

  const joinUrl = buildJoinUrl(window.location.origin, msg.code)

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-4 text-white sm:p-8">
      <div className="w-full max-w-5xl space-y-6 text-center">
        <div className="flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-10">
          <div className="min-w-0">
            <p className="text-xl text-slate-400">Join at {window.location.host}/join with code</p>
            <p
              className="mt-3 font-mono text-6xl font-bold tracking-[0.2em] sm:text-8xl sm:tracking-[0.3em]"
              data-testid="room-code"
            >
              {msg.code}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-center gap-2">
            <a
              href={joinUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open join page for this room"
            >
              <QRCodeSVG
                value={joinUrl}
                size={160}
                bgColor="#ffffff"
                fgColor="#0f172a"
                marginSize={4}
                level="M"
                title="QR code to join this room"
                role="img"
                aria-label="QR code to join this room"
              />
            </a>
            <p className="text-sm text-slate-300">Scan with your phone to join</p>
          </div>
        </div>
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
                  {g.note && <span className="ml-2 text-xs text-slate-300">{g.note}</span>}
                </button>
              ))}
            </div>
            {gameId !== 'mafia' && (
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
            )}
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
