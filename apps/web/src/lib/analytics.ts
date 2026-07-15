'use client'

import type { GameId, PackTone } from '@hpg/shared'
import posthog, { type CaptureResult } from 'posthog-js'

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

function isUrlLike(value: string): boolean {
  return (
    /^(?:[a-z][a-z\d+.-]*:|\/\/|\/|\?|\.{1,2}\/)/i.test(value) ||
    /^[^\s?#]+(?:\/[^\s?#]*)*\?/.test(value)
  )
}

function redactCodeQueryParameter(value: unknown): unknown {
  if (typeof value !== 'string' || !isUrlLike(value)) return value

  const isAbsolute = /^[a-z][a-z\d+.-]*:/i.test(value)
  const isProtocolRelative = value.startsWith('//')
  const isQueryOnly = value.startsWith('?')
  try {
    const url = new URL(value, 'https://analytics-redaction.invalid')
    const codeParameters = [...url.searchParams.keys()].filter(
      (parameter) => parameter.toLowerCase() === 'code',
    )
    if (codeParameters.length === 0) return value

    for (const parameter of codeParameters) url.searchParams.delete(parameter)

    if (isAbsolute) return url.toString()
    if (isProtocolRelative) return `//${url.host}${url.pathname}${url.search}${url.hash}`
    if (isQueryOnly) return `${url.search}${url.hash}`
    return `${url.pathname}${url.search}${url.hash}`
  } catch {
    return value
  }
}

interface RedactionResult {
  value: unknown
  changed: boolean
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== 'object') return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === null || prototype === Object.prototype
}

function redactNestedUrls(value: unknown): RedactionResult {
  if (typeof value === 'string') {
    const redacted = redactCodeQueryParameter(value)
    return { value: redacted, changed: redacted !== value }
  }

  if (Array.isArray(value)) {
    let changed = false
    const redacted = value.map((item) => {
      const result = redactNestedUrls(item)
      changed ||= result.changed
      return result.value
    })
    return changed ? { value: redacted, changed } : { value, changed }
  }

  if (isPlainObject(value)) {
    let changed = false
    const redacted: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value)) {
      const result = redactNestedUrls(item)
      changed ||= result.changed
      redacted[key] = result.value
    }
    return changed ? { value: redacted, changed } : { value, changed }
  }

  return { value, changed: false }
}

/** Remove room credentials recursively immediately before an event is sent. */
export function redactAnalyticsEvent(event: CaptureResult | null): CaptureResult | null {
  if (!event) return null

  const properties = redactNestedUrls(event.properties)
  const set = redactNestedUrls(event.$set)
  const setOnce = redactNestedUrls(event.$set_once)
  if (!properties.changed && !set.changed && !setOnce.changed) return event

  const redacted: CaptureResult = {
    ...event,
    properties: properties.value as CaptureResult['properties'],
  }
  if (event.$set !== undefined) redacted.$set = set.value as CaptureResult['$set']
  if (event.$set_once !== undefined) redacted.$set_once = setOnce.value as CaptureResult['$set_once']
  return redacted
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
    custom_personal_data_properties: ['code'],
    disable_session_recording: true,
    mask_all_element_attributes: true,
    mask_all_text: true,
    mask_personal_data_properties: true,
  })
}

/**
 * Report a client-side exception to PostHog. Silent no-op when analytics is
 * off (no key configured) so local sessions and privacy-opted-out builds
 * never send anything.
 */
export function captureError(error: unknown): void {
  if (!posthog.__loaded) return
  posthog.captureException(error)
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
