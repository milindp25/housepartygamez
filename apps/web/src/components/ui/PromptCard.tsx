import type { ReactNode } from 'react'

/**
 * Round-meta line plus the big prompt heading shared by game screens.
 * Renders exactly one `<h2>` whose text content is the prompt alone —
 * several e2e specs read the screen's single h2. `size` tunes the type
 * scale for TV vs phone; `className` may add non-conflicting extras
 * (e.g. max-widths).
 */
export function PromptCard({
  meta,
  size = 'tv',
  className = '',
  children,
}: {
  meta?: ReactNode
  size?: 'tv' | 'phone'
  className?: string
  children: ReactNode
}) {
  return (
    <header className="space-y-3">
      {meta !== undefined && <p className="text-mist">{meta}</p>}
      <h2 className={`${size === 'tv' ? 'text-4xl' : 'text-xl'} font-bold text-chalk ${className}`}>
        {children}
      </h2>
    </header>
  )
}
