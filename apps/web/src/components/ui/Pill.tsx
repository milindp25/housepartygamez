import type { ButtonHTMLAttributes } from 'react'

export interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
}

/**
 * Selectable chip used for game, tone, and answer choices. Selected pills
 * fill with the flame→punch gradient; unselected pills are translucent
 * stage chips. Exposes `aria-pressed` so the state is not color-only.
 */
export function Pill({ selected = false, className = '', ...props }: PillProps) {
  return (
    <button
      {...props}
      aria-pressed={selected}
      className={`rounded-full px-4 py-2 transition ${
        selected
          ? 'bg-gradient-to-r from-flame to-punch font-bold text-plum'
          : 'border border-line bg-chalk/5 text-chalk hover:bg-chalk/10'
      } ${className}`}
    />
  )
}
