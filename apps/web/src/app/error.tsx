'use client'
import { useEffect } from 'react'
import { captureError } from '@/lib/analytics'

/**
 * App-router error boundary: a crashed game component shows a recoverable
 * screen instead of a white page, and the exception is reported (when
 * analytics is enabled) so client-side failures are visible post-launch.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    captureError(error)
  }, [error])
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-center text-white">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Something went wrong</h1>
        <p className="mb-6 text-slate-400">
          The game screen hit an error. Trying again usually fixes it.
        </p>
        <button onClick={reset} className="rounded-lg bg-indigo-600 px-6 py-3 text-lg font-bold">
          Try again
        </button>
      </div>
    </main>
  )
}
