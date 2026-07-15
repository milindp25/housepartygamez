'use client'

/** Amber "Reconnecting…" strip shown while the socket transport is down. */
export function ConnectionBanner({ connected }: { connected: boolean }) {
  if (connected) return null
  return (
    <p className="mb-4 rounded-lg bg-amber-500/20 px-4 py-2 text-center text-amber-300">
      Reconnecting…
    </p>
  )
}
