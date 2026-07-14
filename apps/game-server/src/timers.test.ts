import { afterEach, describe, expect, it, vi } from 'vitest'
import { mafia, type MafiaState } from '@hpg/shared'
import { RoomManager } from './roomManager'
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

  it('advances authoritative Mafia from night to day and re-arms its next deadline', () => {
    const start = 1_000_000
    vi.useFakeTimers()
    vi.setSystemTime(start)
    const rooms = new RoomManager({ now: () => Date.now() })
    const room = rooms.createRoom()
    for (let index = 0; index < 4; index += 1) {
      rooms.join(room.code, `Timer ${index + 1}`, `timer-mafia-${index}`)
    }
    expect(rooms.startGame(room.code, mafia, [], mafia.defaultSettings)).not.toHaveProperty('error')
    const timers = new RoomTimers()
    const schedule = () => {
      const state = room.game?.state as MafiaState
      timers.reschedule(room.code, state.deadline, () => {
        rooms.applyGameAction(room.code, { type: 'TIMER_EXPIRED', now: Date.now() })
        schedule()
      })
    }
    schedule()
    expect(timers.deadlineFor(room.code)).toBe(start + mafia.defaultSettings.nightSeconds * 1000)

    vi.advanceTimersByTime(mafia.defaultSettings.nightSeconds * 1000)

    const day = room.game?.state as MafiaState
    expect(day).toMatchObject({
      phase: 'day',
      lastNight: { killedId: null, saved: false },
      deadline:
        start +
        (mafia.defaultSettings.nightSeconds + mafia.defaultSettings.discussionSeconds) * 1000,
    })
    expect(timers.deadlineFor(room.code)).toBe(day.deadline)
    timers.clear(room.code)
  })
})
