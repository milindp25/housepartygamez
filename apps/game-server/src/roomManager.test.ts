import { beforeEach, describe, expect, it } from 'vitest'
import { wouldYouRather } from '@hpg/shared'
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

describe('RoomManager game lifecycle', () => {
  function seatedRoom(rooms: RoomManager) {
    const room = rooms.createRoom()
    rooms.join(room.code, 'Ana', 'tok-a')
    rooms.join(room.code, 'Ben', 'tok-b')
    return room
  }

  it('starts a game with seated players and produces per-recipient views', () => {
    const clock = { now: 1_000_000 }
    const rooms = new RoomManager({ now: () => clock.now })
    const room = seatedRoom(rooms)
    const res = rooms.startGame(room.code, wouldYouRather, [{ id: 'q1', a: 'A', b: 'B' }], {
      rounds: 1,
      voteSeconds: 30,
      revealSeconds: 8,
    })
    expect(res).not.toHaveProperty('error')

    const hostMsg = rooms.toHostState(room)
    expect(hostMsg.phase).toBe('game')
    expect(hostMsg.game?.view).toMatchObject({ phase: 'vote', votedCount: 0 })

    const anaMsg = rooms.toPlayerState(room, 'tok-a')
    expect(anaMsg?.game?.view).toMatchObject({ phase: 'vote', yourChoice: null })
  })

  it('rejects start with too few players or an already-running game', () => {
    const rooms = new RoomManager()
    const solo = rooms.createRoom()
    rooms.join(solo.code, 'Ana', 'tok-a')
    expect(
      rooms.startGame(
        solo.code,
        wouldYouRather,
        [{ id: 'q1', a: 'A', b: 'B' }],
        wouldYouRather.defaultSettings,
      ),
    ).toEqual({ error: 'Need at least 2 players' })

    const room = seatedRoom(rooms)
    rooms.startGame(
      room.code,
      wouldYouRather,
      [{ id: 'q1', a: 'A', b: 'B' }],
      wouldYouRather.defaultSettings,
    )
    expect(
      rooms.startGame(
        room.code,
        wouldYouRather,
        [{ id: 'q1', a: 'A', b: 'B' }],
        wouldYouRather.defaultSettings,
      ),
    ).toEqual({ error: 'Game already running' })
  })

  it('applies player input through the reducer and reflects it in views', () => {
    const rooms = new RoomManager()
    const room = seatedRoom(rooms)
    rooms.startGame(room.code, wouldYouRather, [{ id: 'q1', a: 'A', b: 'B' }], {
      rounds: 1,
      voteSeconds: 30,
      revealSeconds: 8,
    })
    rooms.applyGameAction(room.code, {
      type: 'PLAYER_INPUT',
      playerId: rooms.playerByToken(room.code, 'tok-a')!.id,
      input: { choice: 'a' },
      now: Date.now(),
    })
    expect(rooms.toHostState(room).game?.view).toMatchObject({ votedCount: 1 })
  })

  it('endGame returns the room to the lobby', () => {
    const rooms = new RoomManager()
    const room = seatedRoom(rooms)
    rooms.startGame(
      room.code,
      wouldYouRather,
      [{ id: 'q1', a: 'A', b: 'B' }],
      wouldYouRather.defaultSettings,
    )
    rooms.endGame(room.code)
    expect(rooms.toHostState(room).phase).toBe('lobby')
    expect(rooms.toHostState(room).game).toBeUndefined()
  })
})
