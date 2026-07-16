'use client'
import { useEffect, useState } from 'react'
import { Button } from './Button'

/**
 * Copies the room's join URL to the clipboard with a transient "Copied ✓"
 * confirmation (announced politely to screen readers). If the clipboard is
 * unavailable (permissions, insecure context) it fails silently — the QR
 * code and room code on screen remain the join path.
 */
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(id)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Clipboard unavailable — QR and visible code still work.
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={copy}>
        {copied ? 'Copied ✓' : 'Copy invite link'}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Invite link copied' : ''}
      </span>
    </>
  )
}
