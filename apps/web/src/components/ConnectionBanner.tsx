'use client'

/** Honey "Reconnecting…" strip shown while the socket transport is down. */
export function ConnectionBanner({ connected }: { connected: boolean }) {
  if (connected) return null
  return (
    <p
      role="status"
      className="mb-4 rounded-full border border-honey/40 bg-honey/10 px-4 py-2 text-center text-honey"
    >
      Reconnecting…
    </p>
  )
}
