import { beforeEach, describe, expect, it, vi } from 'vitest'

const posthog = vi.hoisted(() => ({
  __loaded: false,
  init: vi.fn(),
  capture: vi.fn(),
}))

vi.mock('posthog-js', () => ({ default: posthog }))

type Track = typeof import('./analytics').track

function assertTrackTypes(track: Track): void {
  track('room_created')
  track('game_started', { gameId: 'mafia', tone: 'friends' })
  // @ts-expect-error Room lifecycle events must never accept properties.
  track('room_created', { code: 'ABCD' })
  // @ts-expect-error Event names are restricted to the product funnel allowlist.
  track('room_code_exposed')
}

void assertTrackTypes

describe('analytics', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', '')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', '')
    posthog.__loaded = false
    posthog.init.mockReset()
    posthog.capture.mockReset()
  })

  it('does not initialize without a project key', async () => {
    const { initAnalytics } = await import('./analytics')

    initAnalytics()

    expect(posthog.init).not.toHaveBeenCalled()
  })

  it('initializes once with privacy-safe capture and history-aware pageviews', async () => {
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_KEY', 'phc_test')
    vi.stubEnv('NEXT_PUBLIC_POSTHOG_HOST', 'https://analytics.example.com')
    posthog.init.mockImplementation(() => {
      posthog.__loaded = true
    })
    const { initAnalytics, redactAnalyticsEvent } = await import('./analytics')

    initAnalytics()
    initAnalytics()

    expect(posthog.init).toHaveBeenCalledOnce()
    expect(posthog.init).toHaveBeenCalledWith('phc_test', {
      api_host: 'https://analytics.example.com',
      autocapture: true,
      before_send: redactAnalyticsEvent,
      capture_pageview: 'history_change',
      disable_session_recording: true,
      mask_all_element_attributes: true,
      mask_all_text: true,
    })
  })

  it('redacts room codes from URL properties without mutating the source event', async () => {
    const { redactAnalyticsEvent } = await import('./analytics')
    const source = {
      uuid: 'event-id',
      event: '$pageview',
      properties: {
        $current_url: '/join?code=ABCD&source=x',
        $referrer: 'https://example.com/join?source=x&code=EFGH',
        $initial_current_url: 'http://[',
        $initial_referrer: 42,
        campaign: 'launch',
      },
    }

    const redacted = redactAnalyticsEvent(source)

    expect(redacted).not.toBe(source)
    expect(redacted?.properties).toEqual({
      $current_url: '/join?source=x',
      $referrer: 'https://example.com/join?source=x',
      $initial_current_url: 'http://[',
      $initial_referrer: 42,
      campaign: 'launch',
    })
    expect(source.properties.$current_url).toBe('/join?code=ABCD&source=x')
  })

  it('passes null events through the before-send redactor', async () => {
    const { redactAnalyticsEvent } = await import('./analytics')

    expect(redactAnalyticsEvent(null)).toBeNull()
  })

  it('does not capture events before PostHog has loaded', async () => {
    const { track } = await import('./analytics')

    track('room_created')

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

  it('captures room lifecycle events without properties', async () => {
    posthog.__loaded = true
    const { track } = await import('./analytics')

    track('room_created')
    track('player_joined')

    expect(posthog.capture).toHaveBeenNthCalledWith(1, 'room_created')
    expect(posthog.capture).toHaveBeenNthCalledWith(2, 'player_joined')
  })

  it('drops non-allowlisted events at runtime', async () => {
    posthog.__loaded = true
    const { track } = await import('./analytics')

    ;(track as (event: string) => void)('room_code_exposed')

    expect(posthog.capture).not.toHaveBeenCalled()
  })

  it('keeps only allowlisted game properties at runtime', async () => {
    posthog.__loaded = true
    const { track } = await import('./analytics')

    ;(track as (event: string, props: Record<string, unknown>) => void)('game_started', {
      gameId: 'mafia',
      tone: 'friends',
      code: 'ABCD',
    })

    expect(posthog.capture).toHaveBeenCalledWith('game_started', {
      gameId: 'mafia',
      tone: 'friends',
    })
  })

  it('drops malformed game-started events without throwing', async () => {
    posthog.__loaded = true
    const { track } = await import('./analytics')
    const untypedTrack = track as (event: string, props?: unknown) => void

    expect(() => untypedTrack('game_started')).not.toThrow()
    expect(() => untypedTrack('game_started', { gameId: 'unknown', tone: 'friends' })).not.toThrow()
    expect(() => untypedTrack('game_started', { gameId: 'mafia' })).not.toThrow()
    expect(posthog.capture).not.toHaveBeenCalled()
  })
})
