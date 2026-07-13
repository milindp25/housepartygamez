import { beforeEach, describe, expect, it } from 'vitest'
import { RoomManager } from './roomManager'

describe('RoomManager', () => {
  let clock: { now: number }
  let rooms: RoomManager

  beforeEach(() => {
    clock = { now: 1_000_000 }
    rooms = new RoomManager({ now: () => clock.now })
  })

  it('creates a room with a 4-letter code and empty lobby', () => {
    const room = rooms.createRoom()
    expect(room.code).toMatch(/^[A-Z]{4}$/)
    expect(rooms.toView(room)).toEqual({ code: room.code, phase: 'lobby', players: [] })
  })

  it('regenerates on code collision', () => {
    // RNG that yields the same code twice, then a different one
    const values = [0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5]
    const rng = () => values.shift() ?? Math.random()
    const collider = new RoomManager({ now: () => clock.now, random: rng })
    const a = collider.createRoom()
    const b = collider.createRoom()
    expect(b.code).not.toBe(a.code)
  })

  it('joins a player by code, case-insensitive', () => {
    const room = rooms.createRoom()
    const res = rooms.join(room.code.toLowerCase(), 'Milind', 'tok-1')
    expect(res).toMatchObject({ player: { nickname: 'Milind', connected: true } })
    expect(rooms.toView(room).players).toHaveLength(1)
  })

  it('rejects unknown room, blank nickname, and duplicate nickname', () => {
    const room = rooms.createRoom()
    expect(rooms.join('XXXX', 'A', 'tok-1')).toEqual({ error: 'Room not found' })
    expect(rooms.join(room.code, '   ', 'tok-1')).toEqual({ error: 'Nickname required' })
    rooms.join(room.code, 'Milind', 'tok-1')
    expect(rooms.join(room.code, 'milind', 'tok-2')).toEqual({ error: 'Nickname taken' })
  })

  it('rejects joins beyond 20 players', () => {
    const room = rooms.createRoom()
    for (let i = 0; i < 20; i++) rooms.join(room.code, `p${i}`, `tok-${i}`)
    expect(rooms.join(room.code, 'late', 'tok-late')).toEqual({ error: 'Room full' })
  })

  it('reconnects the same token to the same seat', () => {
    const room = rooms.createRoom()
    const first = rooms.join(room.code, 'Milind', 'tok-1')
    if ('error' in first) throw new Error('join failed')
    rooms.setConnected(room.code, 'tok-1', false)
    expect(rooms.toView(room).players[0].connected).toBe(false)

    const again = rooms.join(room.code, 'Milind', 'tok-1')
    if ('error' in again) throw new Error('rejoin failed')
    expect(again.player.id).toBe(first.player.id) // same seat
    expect(rooms.toView(room).players).toHaveLength(1)
    expect(rooms.toView(room).players[0].connected).toBe(true)
  })

  it('expires rooms idle past the limit, keeps active ones', () => {
    const idle = rooms.createRoom()
    clock.now += 30 * 60_000
    const active = rooms.createRoom()
    clock.now += 31 * 60_000 // idle is 61min old, active 31min

    const expired = rooms.sweepExpired(60 * 60_000)
    expect(expired).toEqual([idle.code])
    expect(rooms.getRoom(idle.code)).toBeUndefined()
    expect(rooms.getRoom(active.code)).toBeDefined()
  })

  it('any activity (join) resets the idle clock', () => {
    const room = rooms.createRoom()
    clock.now += 59 * 60_000
    rooms.join(room.code, 'Milind', 'tok-1')
    clock.now += 59 * 60_000
    expect(rooms.sweepExpired(60 * 60_000)).toEqual([])
  })

  it('empty lobbies expire on the shorter limit', () => {
    const empty = rooms.createRoom()
    const joined = rooms.createRoom()
    rooms.join(joined.code, 'Milind', 'tok-1')
    clock.now += 31 * 60_000
    expect(rooms.sweepExpired(60 * 60_000, 30 * 60_000)).toEqual([empty.code])
    expect(rooms.getRoom(joined.code)).toBeDefined()
  })
})
