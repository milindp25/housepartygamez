/**
 * Sliding-window rate limiter keyed by an arbitrary string (in production, a
 * client IP). Each key gets its own independent budget of `max` attempts per
 * `windowMs`; attempts older than the window are pruned lazily on read.
 *
 * Used to throttle `room:create` and `room:join` — both are otherwise
 * unauthenticated, effectively free for the server to process, and abusable
 * at line speed (room-cap exhaustion, room-code brute-forcing) without this.
 */
export class RateLimiter {
  private hits = new Map<string, number[]>()
  private readonly max: number
  private readonly windowMs: number
  private readonly now: () => number

  /**
   * @param opts.max - Attempts allowed per key within the window.
   * @param opts.windowMs - Window size in milliseconds.
   * @param opts.now - Clock source; defaults to `Date.now`. Injectable for
   *   deterministic tests.
   */
  constructor(opts: { max: number; windowMs: number; now?: () => number }) {
    this.max = opts.max
    this.windowMs = opts.windowMs
    this.now = opts.now ?? Date.now
  }

  /**
   * Record an attempt for `key` and report whether it's within budget.
   *
   * @returns `true` and records the attempt if under the limit; `false`
   *   (and does NOT record it) if `key` has already used its full budget
   *   within the current window.
   */
  attempt(key: string): boolean {
    const now = this.now()
    const windowStart = now - this.windowMs
    const timestamps = (this.hits.get(key) ?? []).filter((t) => t > windowStart)
    if (timestamps.length >= this.max) {
      this.hits.set(key, timestamps)
      return false
    }
    timestamps.push(now)
    this.hits.set(key, timestamps)
    return true
  }

  /**
   * Drop keys with no attempts left in the current window, so long-running
   * processes don't accumulate an unbounded map of one-off IPs. Safe to call
   * periodically (e.g. on the same interval as the room-expiry sweep).
   */
  sweep(): void {
    const windowStart = this.now() - this.windowMs
    for (const [key, timestamps] of this.hits) {
      const fresh = timestamps.filter((t) => t > windowStart)
      if (fresh.length === 0) this.hits.delete(key)
      else this.hits.set(key, fresh)
    }
  }

  /** Number of tracked keys; for diagnostics/tests. */
  size(): number {
    return this.hits.size
  }
}
