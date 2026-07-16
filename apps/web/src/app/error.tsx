'use client'
import { useEffect } from 'react'
import { captureError } from '@/lib/analytics'
import { Button } from '@/components/ui/Button'

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
    <main className="grid min-h-screen place-items-center p-6 text-center text-chalk">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Something went wrong</h1>
        <p className="mb-6 text-mist">
          The game screen hit an error. Trying again usually fixes it.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
  )
}
