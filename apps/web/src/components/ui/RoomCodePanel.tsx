'use client'
import { QRCodeSVG } from 'qrcode.react'
import { CopyLinkButton } from './CopyLinkButton'

/**
 * The host lobby's join block: giant gradient room code, QR code, join URL
 * host, and a copy-invite-link button. The code stays a single element so
 * `data-testid="room-code"` reads as exactly four letters.
 */
export function RoomCodePanel({
  code,
  joinUrl,
  joinHost,
}: {
  code: string
  joinUrl: string
  joinHost: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-10">
      <div className="min-w-0">
        <p className="text-xl text-mist">Join at {joinHost}/join with code</p>
        <p
          className="mt-3 bg-gradient-to-r from-honey via-flame to-punch bg-clip-text font-mono text-6xl font-bold tracking-[0.2em] text-transparent sm:text-8xl sm:tracking-[0.3em]"
          data-testid="room-code"
        >
          {code}
        </p>
        <div className="mt-4 flex justify-center">
          <CopyLinkButton url={joinUrl} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-2">
        <a
          href={joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open join page for this room"
          className="overflow-hidden rounded-2xl border border-line"
        >
          <QRCodeSVG
            value={joinUrl}
            size={160}
            bgColor="#FDF4EC"
            fgColor="#1C1420"
            marginSize={4}
            level="M"
            title="QR code to join this room"
            role="img"
            aria-label="QR code to join this room"
          />
        </a>
        <p className="text-sm text-chalk/80">Scan with your phone to join</p>
      </div>
    </div>
  )
}
