'use client'

import { useEffect } from 'react'
import { initAnalytics } from '@/lib/analytics'

/** Initialize browser-only integrations while preserving the server-rendered app shell. */
export function Providers({ children }: Readonly<{ children: React.ReactNode }>) {
  useEffect(() => {
    initAnalytics()
  }, [])

  return children
}
