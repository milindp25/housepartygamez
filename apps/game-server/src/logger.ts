import { pino } from 'pino'

/**
 * Structured JSON logger — one JSON object per line so log aggregators
 * (Railway, Datadog, Loki, CloudWatch) can index and search fields directly.
 *
 * Conventions:
 * - every entry carries an `event` name (snake_case) plus context fields
 *   such as `roomCode`, `playerId`, `socketId`
 * - `info` = lifecycle, `warn` = rejected/invalid client actions, `error` = exceptions
 * - production emits raw JSON; dev pretty-prints; tests are silent
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  transport: process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
})
