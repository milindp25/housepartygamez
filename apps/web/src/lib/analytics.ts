'use client'

import posthog from 'posthog-js'

/** No-ops when no project key is configured so local sessions stay out of product data. */
export function initAnalytics(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key || posthog.__loaded) return

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    capture_pageview: true,
    autocapture: true,
  })
}

/** Capture a named product event only after the PostHog client has loaded. */
export function track(event: string, props?: Record<string, unknown>): void {
  if (posthog.__loaded) posthog.capture(event, props)
}
