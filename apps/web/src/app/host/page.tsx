'use client'
import { useEffect, useRef, useState } from 'react'
import type { GameId, PackTone, RoomStateMsg } from '@hpg/shared'
import { track } from '@/lib/analytics'
import { buildJoinUrl } from '@/lib/join-url'
import { onConnectionChange, onReconnect } from '@/lib/reconnect'
import { getSocket } from '@/lib/socket'
import { ConnectionBanner } from '@/components/ConnectionBanner'
import { GameHost } from '@/components/host/GameHost'
import { Button } from '@/components/ui/Button'
import { Pill } from '@/components/ui/Pill'
import { PlayerChips } from '@/components/ui/PlayerChips'
import { RoomCodePanel } from '@/components/ui/RoomCodePanel'

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
  const [connected, setConnected] = useState(true)
  const [confirmSpicy, setConfirmSpicy] = useState(false)
  const createdRef = useRef(false)

  useEffect(() => {
    const socket = getSocket()
    socket.on('room:state', setMsg)
    const offStatus = onConnectionChange(socket, setConnected)
    if (!createdRef.current) {
      createdRef.current = true
      socket.emit('room:create', (res) => {
        if (!res.ok) {
          setFatal(res.error)
          return
        }
        sessionStorage.setItem(`hpg:hostToken:${res.code}`, res.hostToken)
        setMsg({ code: res.code, phase: 'lobby', players: [] })
        track('room_created')
      })
    }
    return () => {
      socket.off('room:state', setMsg)
      offStatus()
    }
  }, [])

  const roomCode = msg?.code
  // Re-attach this screen to its room after a transport drop; the stored
  // hostToken restores host powers on the fresh server-side connection.
  useEffect(() => {
    if (!roomCode) return
    const socket = getSocket()
    return onReconnect(socket, () => {
      const hostToken = sessionStorage.getItem(`hpg:hostToken:${roomCode}`) ?? ''
      socket.emit('room:watch', { code: roomCode, hostToken }, (res) => {
        if (res.ok) setMsg(res.view)
        else setFatal('This room has expired — refresh to start a new one.')
      })
    })
  }, [roomCode])

  const needsSpicyConfirm = gameId !== 'mafia' && tone === 'spicy'

  /** First click on Start arms the inline 18+ confirm for spicy packs. */
  function startGame() {
    if (needsSpicyConfirm && !confirmSpicy) {
      setConfirmSpicy(true)
      return
    }
    doStart()
  }

  /** Emit game:start; the server enforces game/pack validity. */
  function doStart() {
    setConfirmSpicy(false)
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
      <main className="grid min-h-screen place-items-center p-8 text-chalk">
        <p role="alert" className="text-xl text-red-400">
          {fatal}
        </p>
      </main>
    )
  }
  if (!msg)
    return <main className="grid min-h-screen place-items-center text-mist">Creating room…</main>

  if (msg.phase === 'game' && msg.game) {
    return (
      <main className="grid min-h-screen place-items-center p-8 text-chalk">
        <ConnectionBanner connected={connected} />
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
    <main className="grid min-h-screen place-items-center p-4 text-chalk sm:p-8">
      <div className="w-full max-w-5xl space-y-6 text-center">
        <ConnectionBanner connected={connected} />
        <RoomCodePanel code={msg.code} joinUrl={joinUrl} joinHost={window.location.host} />
        <PlayerChips players={msg.players} />
        {msg.players.length === 0 ? (
          <p className="waiting-pulse text-mist">Waiting for players…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-center gap-2">
              {GAMES.map((g) => (
                <Pill
                  key={g.id}
                  selected={gameId === g.id}
                  onClick={() => {
                    setGameId(g.id)
                    setConfirmSpicy(false)
                  }}
                >
                  {g.name}
                  {g.note && <span className="ml-2 text-xs opacity-70">{g.note}</span>}
                </Pill>
              ))}
            </div>
            {gameId !== 'mafia' && (
              <div className="flex justify-center gap-2">
                {TONES.map((t) => (
                  <Pill
                    key={t}
                    selected={tone === t}
                    className="capitalize"
                    onClick={() => {
                      setTone(t)
                      setConfirmSpicy(false)
                    }}
                  >
                    {t}
                    {t === 'spicy' && ' 🔞'}
                  </Pill>
                ))}
              </div>
            )}
            {confirmSpicy && needsSpicyConfirm ? (
              <section className="mx-auto max-w-md space-y-3 rounded-2xl border border-punch/50 bg-punch/10 p-5">
                <p className="text-lg font-bold">Spicy pack is 18+.</p>
                <p className="text-mist">Make sure everyone in the room is an adult.</p>
                <div className="flex flex-wrap justify-center gap-3">
                  {/* autoFocus: the Start button this section replaced had focus. */}
                  <Button autoFocus onClick={doStart}>
                    Everyone&apos;s 18+ — start
                  </Button>
                  <Button variant="secondary" onClick={() => setConfirmSpicy(false)}>
                    Cancel
                  </Button>
                </div>
              </section>
            ) : (
              <Button size="lg" onClick={startGame}>
                Start {GAMES.find((g) => g.id === gameId)?.name}
              </Button>
            )}
            {error && (
              <p role="alert" className="text-red-400">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
}
