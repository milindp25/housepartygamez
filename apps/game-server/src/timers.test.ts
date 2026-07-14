import { afterEach, describe, expect, it, vi } from 'vitest'
import { RoomTimers } from './timers'

afterEach(() => vi.useRealTimers())

describe('RoomTimers', () => {
  it('clears the old callback and arms the replacement deadline', () => {
    vi.useFakeTimers()
    vi.setSystemTime(1_000)
    const timers = new RoomTimers()
    const oldExpired = vi.fn()
    const replacementExpired = vi.fn()

    timers.reschedule('ABCD', 2_000, oldExpired)
    timers.reschedule('ABCD', 3_000, replacementExpired)
    expect(timers.deadlineFor('ABCD')).toBe(3_000)

    vi.advanceTimersByTime(1_000)
    expect(oldExpired).not.toHaveBeenCalled()
    expect(replacementExpired).not.toHaveBeenCalled()
    expect(timers.deadlineFor('ABCD')).toBe(3_000)

    vi.advanceTimersByTime(1_000)
    expect(oldExpired).not.toHaveBeenCalled()
    expect(replacementExpired).toHaveBeenCalledOnce()
    expect(timers.deadlineFor('ABCD')).toBeUndefined()
  })
})
