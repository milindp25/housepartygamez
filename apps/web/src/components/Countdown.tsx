'use client'
import { useEffect, useState } from 'react'

/**
 * Seconds-remaining pill driven by a server-authoritative deadline (epoch
 * ms). The server owns the source of truth; this component only re-ticks
 * the on-screen number four times a second so the countdown looks smooth.
 * Renders nothing when `deadline` is null (the game is waiting on a host
 * action rather than a clock).
 */
export function Countdown({ deadline }: { deadline: number | null }) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (deadline === null) return
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [deadline])
  if (deadline === null) return null
  return (
    <span className="rounded-full border border-line bg-stage px-3 py-1 font-mono text-lg text-honey">
      {left}s
    </span>
  )
}
