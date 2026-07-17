'use client'
import { useState } from 'react'
import { normalizeRoomCode } from '@/lib/room-code'

const TILE_TINTS = ['text-chalk', 'text-honey', 'text-chalk', 'text-punch'] as const

/**
 * Four-tile room-code entry backed by a single invisible `<input>` layered
 * over the tiles, so paste, autofill, Enter-to-submit, and `?code=` prefill
 * behave exactly like a plain text field while the tiles carry the visuals.
 * Every change is passed through {@link normalizeRoomCode}. Deliberately no
 * native maxLength: it would truncate a messy paste (e.g. "Code: PART")
 * before normalization strips the noise — the normalizer's slice is the cap.
 */
export function CodeInput({
  value,
  onChange,
}: {
  value: string
  onChange: (code: string) => void
}) {
  const [focused, setFocused] = useState(false)
  const activeIndex = Math.min(value.length, 3)
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(normalizeRoomCode(e.target.value))}
        placeholder="ROOM CODE"
        autoCapitalize="characters"
        autoComplete="one-time-code"
        aria-label="Room code"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 z-10 h-full w-full cursor-text text-3xl opacity-0"
      />
      <div aria-hidden="true" className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            data-tile
            className={`grid h-16 place-items-center rounded-xl border bg-stage font-mono text-3xl font-bold ${TILE_TINTS[i]} ${
              focused && i === activeIndex ? 'border-flame' : 'border-line'
            }`}
          >
            {value[i] ?? ''}
          </span>
        ))}
      </div>
    </div>
  )
}
