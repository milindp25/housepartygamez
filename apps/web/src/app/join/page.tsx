'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { RoomStateMsg } from '@hpg/shared'
import { track } from '@/lib/analytics'
import { onConnectionChange, onReconnect } from '@/lib/reconnect'
import { getPlayerToken, getSocket } from '@/lib/socket'
import { ConnectionBanner } from '@/components/ConnectionBanner'
import { GamePlay } from '@/components/play/GamePlay'

/**
 * The phone-facing join flow. Renders a code + nickname form (the code is
 * prefilled from a `?code=` query param when a player follows a link), emits
 * `room:join`, and on success swaps to the live lobby view driven by
 * `room:state` broadcasts. Join errors from the server are shown inline.
 */
function JoinForm() {
  const params = useSearchParams()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<RoomStateMsg | null>(null)
  const [connected, setConnected] = useState(true)
  const [seat, setSeat] = useState<{ code: string; nickname: string } | null>(null)

  useEffect(() => {
    const socket = getSocket()
    socket.on('room:state', setView)
    const offStatus = onConnectionChange(socket, setConnected)
    return () => {
      socket.off('room:state', setView)
      offStatus()
    }
  }, [])

  // Reclaim the seat after a transport drop (venue wifi, locked phone). The
  // server recognises the stored playerToken and restores the original seat.
  useEffect(() => {
    if (!seat) return
    const socket = getSocket()
    return onReconnect(socket, () => {
      socket.emit(
        'room:join',
        { code: seat.code, nickname: seat.nickname, playerToken: getPlayerToken() },
        (res) => {
          if (res.ok) {
            setView(res.view)
            return
          }
          setView(null)
          setSeat(null)
          setError('The room has closed — ask the host for a new code.')
        },
      )
    })
  }, [seat])

  function join(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const trimmedCode = code.trim()
    getSocket().emit(
      'room:join',
      { code: trimmedCode, nickname, playerToken: getPlayerToken() },
      (res) => {
        if (!res.ok) {
          setError(res.error)
          return
        }
        setSeat({ code: trimmedCode, nickname })
        setView(res.view)
        track('player_joined')
      },
    )
  }

  if (view) {
    if (view.phase === 'game' && view.game) {
      return (
        <main className="min-h-screen bg-slate-950 p-6 text-white">
          <ConnectionBanner connected={connected} />
          <GamePlay gameId={view.game.id} view={view.game.view} />
        </main>
      )
    }
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <ConnectionBanner connected={connected} />
        <h1 className="mb-4 text-2xl font-bold">Room {view.code}</h1>
        <p className="mb-2 text-slate-400">Waiting for the host to start…</p>
        <ul className="space-y-2">
          {view.players.map((p) => (
            <li key={p.id} className={p.connected ? '' : 'text-slate-500 line-through'}>
              {p.nickname}
            </li>
          ))}
        </ul>
      </main>
    )
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white">
      <form onSubmit={join} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-center text-3xl font-bold">Join a game</h1>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ROOM CODE"
          maxLength={4}
          autoCapitalize="characters"
          className="rounded-lg bg-slate-800 p-4 text-center font-mono text-2xl tracking-[0.3em]"
        />
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Your nickname"
          maxLength={20}
          className="rounded-lg bg-slate-800 p-4 text-lg"
        />
        {error && <p className="text-center text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={code.length !== 4 || !nickname.trim()}
          className="rounded-lg bg-emerald-600 p-4 text-lg font-bold disabled:opacity-40"
        >
          Join
        </button>
      </form>
    </main>
  )
}

/**
 * Route entry for `/join`. Wraps {@link JoinForm} in a Suspense boundary
 * because `useSearchParams` requires one to stream the query string on the
 * client without blocking the static shell.
 */
export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  )
}
