'use client'

import type { GameId, PackTone } from '@hpg/shared'
import posthog, { type CaptureResult } from 'posthog-js'

const URL_PROPERTIES = [
  '$current_url',
  '$referrer',
  '$initial_current_url',
  '$initial_referrer',
] as const

const FUNNEL_EVENTS = new Set<AnalyticsEvent>([
  'room_created',
  'player_joined',
  'game_started',
])

const GAME_IDS = new Set<GameId>([
  'would-you-rather',
  'most-likely-to',
  'never-have-i-ever',
  'who-said-that',
  'imposter',
  'bluff-battle',
  'mafia',
])

const PACK_TONES = new Set<PackTone>(['family', 'friends', 'spicy'])

/** Privacy-reviewed dimensions permitted on a successful game-start event. */
export interface GameStartedProperties {
  gameId: GameId
  tone: PackTone
}

interface AnalyticsEventProperties {
  room_created: undefined
  player_joined: undefined
  game_started: GameStartedProperties
}

/** Custom product events approved for the anonymous launch funnel. */
export type AnalyticsEvent = keyof AnalyticsEventProperties

type AnalyticsArguments<Event extends AnalyticsEvent> =
  AnalyticsEventProperties[Event] extends undefined
    ? []
    : [properties: AnalyticsEventProperties[Event]]

function isGameStartedProperties(value: unknown): value is GameStartedProperties {
  if (!value || typeof value !== 'object') return false

  const properties = value as Record<string, unknown>
  return GAME_IDS.has(properties.gameId as GameId) && PACK_TONES.has(properties.tone as PackTone)
}

function redactCodeQueryParameter(value: unknown): unknown {
  if (typeof value !== 'string') return value

  const isAbsolute = /^[a-z][a-z\d+.-]*:/i.test(value)
  try {
    const url = new URL(value, 'https://analytics-redaction.invalid')
    if (!url.searchParams.has('code')) return value

    url.searchParams.delete('code')
    return isAbsolute ? url.toString() : `${url.pathname}${url.search}${url.hash}`
  } catch {
    return value
  }
}

/** Remove room credentials from URL fields immediately before an event is sent. */
export function redactAnalyticsEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null

  let changed = false
  const properties = { ...event.properties }

  for (const property of URL_PROPERTIES) {
    const current = properties[property]
    const redacted = redactCodeQueryParameter(current)
    if (redacted !== current) {
      properties[property] = redacted
      changed = true
    }
  }

  return changed ? { ...event, properties } : event
}

/** No-ops when no project key is configured so local sessions stay out of product data. */
export function initAnalytics(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key || posthog.__loaded) return

  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    autocapture: true,
    before_send: redactAnalyticsEvent,
    capture_pageview: 'history_change',
    disable_session_recording: true,
    mask_all_element_attributes: true,
    mask_all_text: true,
  })
}

/** Capture only the allowlisted, privacy-reviewed product funnel events. */
export function track<Event extends AnalyticsEvent>(
  event: Event,
  ...args: AnalyticsArguments<Event>
): void {
  if (!posthog.__loaded || !FUNNEL_EVENTS.has(event)) return

  if (event === 'game_started') {
    const properties: unknown = args[0]
    if (!isGameStartedProperties(properties)) return
    posthog.capture(event, { gameId: properties.gameId, tone: properties.tone })
    return
  }

  posthog.capture(event)
}
