import { beforeEach, describe, expect, it, vi } from 'vitest'

const posthog = vi.hoisted(() => ({
  __loaded: false,
  init: vi.fn(),
  capture: vi.fn(),
  captureException: vi.fn(),
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
    posthog.captureException.mockReset()
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
      custom_personal_data_properties: ['code'],
      disable_session_recording: true,
      mask_all_element_attributes: true,
      mask_personal_data_properties: true,
      mask_all_text: true,
    })
  })

  it('recursively redacts room codes from enriched URLs without mutating the source event', async () => {
    const { redactAnalyticsEvent } = await import('./analytics')
    const observedAt = new Date('2026-07-14T12:00:00.000Z')
    const source = {
      uuid: 'event-id',
      event: '$pageview',
      properties: {
        $current_url: '/join?code=ABCD&source=x',
        $session_entry_url: 'https://example.com/join?CODE=EFGH&source=qr#party',
        $session_entry_referrer: 'http://[',
        $elements: [
          {
            tag_name: 'a',
            href: 'https://example.com/join?source=card&CoDe=IJKL#join',
            attributes: { role: 'button' },
          },
        ],
        observedAt,
        label: 'not a url?code=KEEP',
        campaign: 'launch',
      },
      $set: {
        latest_join_url: '/join?source=set&code=MNOP',
      },
      $set_once: {
        $initial_current_url: 'https://example.com/join?code=QRST&source=first',
        nested: [{ referrer: '/join?CoDe=UVWX&source=nested#fragment' }],
        untouched: 42,
      },
    }

    const redacted = redactAnalyticsEvent(source)

    expect(redacted).not.toBe(source)
    expect(redacted?.properties).toEqual({
      $current_url: '/join?source=x',
      $session_entry_url: 'https://example.com/join?source=qr#party',
      $session_entry_referrer: 'http://[',
      $elements: [
        {
          tag_name: 'a',
          href: 'https://example.com/join?source=card#join',
          attributes: { role: 'button' },
        },
      ],
      observedAt,
      label: 'not a url?code=KEEP',
      campaign: 'launch',
    })
    expect(redacted?.$set).toEqual({ latest_join_url: '/join?source=set' })
    expect(redacted?.$set_once).toEqual({
      $initial_current_url: 'https://example.com/join?source=first',
      nested: [{ referrer: '/join?source=nested#fragment' }],
      untouched: 42,
    })
    expect(source.properties.$current_url).toBe('/join?code=ABCD&source=x')
    expect(source.properties.$elements[0]?.href).toContain('CoDe=IJKL')
    expect(source.$set_once.nested[0]?.referrer).toContain('CoDe=UVWX')
    expect(redacted?.properties.observedAt).toBe(observedAt)
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

  it('captureError no-ops when posthog is not loaded', async () => {
    const { captureError } = await import('./analytics')
    captureError(new Error('boom'))
    expect(posthog.captureException).not.toHaveBeenCalled()
  })

  it('captureError forwards to posthog once loaded', async () => {
    posthog.__loaded = true
    const { captureError } = await import('./analytics')
    captureError(new Error('boom'))
    expect(posthog.captureException).toHaveBeenCalledWith(expect.any(Error))
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
