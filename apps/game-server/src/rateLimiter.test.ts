import { describe, expect, it } from 'vitest'
import { RateLimiter } from './rateLimiter'

describe('RateLimiter', () => {
  it('allows up to max attempts per key within the window, then rejects', () => {
    const limiter = new RateLimiter({ max: 3, windowMs: 1_000, now: () => 0 })
    expect(limiter.attempt('1.2.3.4')).toBe(true)
    expect(limiter.attempt('1.2.3.4')).toBe(true)
    expect(limiter.attempt('1.2.3.4')).toBe(true)
    expect(limiter.attempt('1.2.3.4')).toBe(false)
  })

  it('tracks keys independently', () => {
    const limiter = new RateLimiter({ max: 1, windowMs: 1_000, now: () => 0 })
    expect(limiter.attempt('attacker')).toBe(true)
    expect(limiter.attempt('attacker')).toBe(false)
    expect(limiter.attempt('someone-else')).toBe(true)
  })

  it('lets a key back in once its oldest attempt ages out of the window', () => {
    let t = 0
    const limiter = new RateLimiter({ max: 2, windowMs: 1_000, now: () => t })
    expect(limiter.attempt('k')).toBe(true)
    t = 500
    expect(limiter.attempt('k')).toBe(true)
    t = 999
    expect(limiter.attempt('k')).toBe(false) // both prior attempts (t=0, t=500) still in window
    t = 1_001
    expect(limiter.attempt('k')).toBe(true) // the t=0 attempt has aged out; one slot free
    expect(limiter.attempt('k')).toBe(false) // but the t=500 attempt is still within its own window
  })

  it('sweep drops keys with no attempts left in the window, keeping fresh ones', () => {
    let t = 0
    const limiter = new RateLimiter({ max: 5, windowMs: 1_000, now: () => t })
    limiter.attempt('stale')
    t = 2_000
    limiter.attempt('fresh')
    limiter.sweep()
    expect(limiter.size()).toBe(1)
    // The stale key was swept, so it gets a full fresh allowance again.
    t = 2_001
    for (let i = 0; i < 5; i++) expect(limiter.attempt('stale')).toBe(true)
    expect(limiter.attempt('stale')).toBe(false)
  })
})
