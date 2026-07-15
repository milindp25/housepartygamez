import { beforeEach, describe, expect, it, vi } from 'vitest'

const posthog = vi.hoisted(() => ({
  __loaded: false,
  init: vi.fn(),
  capture: vi.fn(),
}))

vi.mock('posthog-js', () => ({ default: posthog }))

describe('analytics', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    posthog.__loaded = false
    posthog.init.mockReset()
    posthog.capture.mockReset()
  })

  it('does not initialize without a project key', async () => {
    const { initAnalytics } = await import('./analytics')

    initAnalytics()

    expect(posthog.init).not.toHaveBeenCalled()
  })

  it('initializes once with the configured host, pageviews, and autocapture', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://analytics.example.com')
    posthog.init.mockImplementation(() => {
      posthog.__loaded = true
    })
    const { initAnalytics } = await import('./analytics')

    initAnalytics()
    initAnalytics()

    expect(posthog.init).toHaveBeenCalledOnce()
    expect(posthog.init).toHaveBeenCalledWith('phc_test', {
      api_host: 'https://analytics.example.com',
      autocapture: true,
      capture_pageview: true,
    })
  })

  it('does not capture events before PostHog has loaded', async () => {
    const { track } = await import('./analytics')

    track('room_created', { code: 'ABCD' })

    expect(posthog.capture).not.toHaveBeenCalled()
  })

  it('captures events after PostHog has loaded', async () => {
    posthog.__loaded = true
    const { track } = await import('./analytics')

    track('game_started', { gameId: 'mafia', tone: 'friends' })

    expect(posthog.capture).toHaveBeenCalledWith('game_started', {
      gameId: 'mafia',
      tone: 'friends',
    })
  })
})
