import { describe, expect, it } from 'vitest'
import type { GamePlayer } from '../engine/types'
import type { MafiaState } from './mafia'
import { mafia } from './mafia'

const players: GamePlayer[] = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'].map((id, i) => ({
  id,
  nickname: `N${i + 1}`,
  connected: true,
}))
const settings = { nightSeconds: 45, discussionSeconds: 120, voteSeconds: 45, revealSeconds: 10 }
const T0 = 1_000_000

function fresh(customPlayers = players): MafiaState {
  return mafia.init({ players: customPlayers, prompts: [], settings, now: T0 })
}

function input(s: MafiaState, playerId: string, targetId: unknown): MafiaState {
  return mafia.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { targetId }, now: T0 })
}

function connection(s: MafiaState, playerId: string, connected: boolean, now = T0): MafiaState {
  return mafia.reducer(s, { type: 'PLAYER_CONNECTION_CHANGED', playerId, connected, now })
}

function byRole(s: MafiaState, role: string): string[] {
  return Object.entries(s.roles)
    .filter(([, assignedRole]) => assignedRole === role)
    .map(([id]) => id)
}

function playNight(s: MafiaState, victim: string, save: string, check: string): MafiaState {
  for (const mafioso of byRole(s, 'mafia')) {
    if (s.alive[mafioso]) s = input(s, mafioso, victim)
  }
  const [doctor] = byRole(s, 'doctor')
  if (s.alive[doctor]) s = input(s, doctor, save)
  const [detective] = byRole(s, 'detective')
  if (s.alive[detective]) s = input(s, detective, check)
  return s
}

function toVote(s: MafiaState): MafiaState {
  return mafia.reducer(s, { type: 'HOST_ADVANCE', now: T0 })
}

describe('mafia', () => {
  it('assigns 1 mafia, 1 doctor, 1 detective, and 4 civilians deterministically for 7 players', () => {
    const a = fresh()
    const b = fresh()
    expect(a.roles).toEqual(b.roles)
    expect(byRole(a, 'mafia')).toHaveLength(1)
    expect(byRole(a, 'doctor')).toHaveLength(1)
    expect(byRole(a, 'detective')).toHaveLength(1)
    expect(byRole(a, 'civilian')).toHaveLength(4)
  })

  it('scales to 2 mafia for 8 players', () => {
    const s = fresh([...players, { id: 'p8', nickname: 'N8', connected: true }])
    expect(byRole(s, 'mafia')).toHaveLength(2)
  })

  it('starts night one with the configured timer and isolated player data', () => {
    const s = fresh()
    expect(s).toMatchObject({ phase: 'night', day: 1, deadline: T0 + 45_000, winner: null })
    expect(s.players).not.toBe(players)
  })

  it('resolves night after every connected living role-holder acts and kills an unprotected victim', () => {
    let s = fresh()
    const [victim, other] = byRole(s, 'civilian')
    s = playNight(s, victim, other, other)
    expect(s.phase).toBe('day')
    expect(s.alive[victim]).toBe(false)
    expect(s.lastNight).toEqual({ killedId: victim, saved: false })
    expect(s.deadline).toBe(T0 + settings.discussionSeconds * 1000)
  })

  it('negates a mafia kill with a doctor save without revealing the target', () => {
    let s = fresh()
    const [victim, other] = byRole(s, 'civilian')
    s = playNight(s, victim, victim, other)
    expect(s.alive[victim]).toBe(true)
    expect(s.lastNight).toEqual({ killedId: null, saved: true })
    expect(mafia.hostView(s)).toMatchObject({
      phase: 'day',
      lastNight: { killedNickname: null, saved: true },
    })
  })

  it('records a detective result only in the detective player view', () => {
    let s = fresh()
    const [mafioso] = byRole(s, 'mafia')
    const [detective] = byRole(s, 'detective')
    const [victim, save] = byRole(s, 'civilian')
    s = playNight(s, victim, save, mafioso)
    expect(s.detectiveLog).toEqual([{ targetNickname: expect.any(String), isMafia: true }])
    expect(mafia.playerView(s, detective)).toHaveProperty('detectiveLog', s.detectiveLog)
    expect(mafia.playerView(s, save)).not.toHaveProperty('detectiveLog')
    expect(mafia.hostView(s)).not.toHaveProperty('detectiveLog')
  })

  it('shows the complete mafia team only to mafia players', () => {
    const s = fresh([...players, { id: 'p8', nickname: 'N8', connected: true }])
    const mafiosi = byRole(s, 'mafia')
    expect(mafia.playerView(s, mafiosi[0])).toMatchObject({
      role: 'mafia',
      mafiaTeam: mafiosi.map((id) => s.players.find((p) => p.id === id)?.nickname),
    })
    expect(mafia.playerView(s, byRole(s, 'civilian')[0])).not.toHaveProperty('mafiaTeam')
  })

  it('rejects missing, malformed, dead, unknown, and non-living night targets', () => {
    const s = fresh()
    const [mafioso] = byRole(s, 'mafia')
    const target = byRole(s, 'civilian')[0]
    const deadState = { ...s, alive: { ...s.alive, [target]: false } }
    expect(input(s, 'unknown', target)).toBe(s)
    expect(input(s, mafioso, 42)).toBe(s)
    expect(input(s, mafioso, 'unknown')).toBe(s)
    expect(input(deadState, mafioso, target)).toBe(deadState)
    expect(input({ ...s, alive: { ...s.alive, [mafioso]: false } }, mafioso, target)).toEqual({
      ...s,
      alive: { ...s.alive, [mafioso]: false },
    })
  })

  it('rejects mafia friendly fire, detective self-checks, and civilian night actions', () => {
    const s = fresh([...players, { id: 'p8', nickname: 'N8', connected: true }])
    const [mafioso, teammate] = byRole(s, 'mafia')
    const [detective] = byRole(s, 'detective')
    const [civilian] = byRole(s, 'civilian')
    expect(input(s, mafioso, teammate)).toBe(s)
    expect(input(s, detective, detective)).toBe(s)
    expect(input(s, civilian, detective)).toBe(s)
  })

  it('allows the doctor to save themself', () => {
    const s = fresh()
    const [doctor] = byRole(s, 'doctor')
    expect(input(s, doctor, doctor).night.doctorSave).toBe(doctor)
  })

  it('uses a deterministic tie-break for tied mafia night votes', () => {
    const customPlayers = [...players, { id: 'p8', nickname: 'N8', connected: true }]
    const setup = () => {
      let s = fresh(customPlayers)
      const mafiosi = byRole(s, 'mafia')
      const civilians = byRole(s, 'civilian')
      s = input(s, mafiosi[0], civilians[0])
      s = input(s, mafiosi[1], civilians[1])
      s = input(s, byRole(s, 'doctor')[0], civilians[2])
      return input(s, byRole(s, 'detective')[0], civilians[2])
    }
    expect(setup().lastNight?.killedId).toBe(setup().lastNight?.killedId)
    expect(setup().lastNight?.killedId).not.toBeNull()
  })

  it('eliminates the unique day-vote plurality and reveals the role', () => {
    let s = fresh()
    const civilians = byRole(s, 'civilian')
    s = toVote(playNight(s, civilians[0], civilians[1], civilians[1]))
    const alive = players.filter((p) => s.alive[p.id]).map((p) => p.id)
    for (const voter of alive) s = input(s, voter, voter === civilians[1] ? alive[0] : civilians[1])
    expect(s.phase).toBe('reveal')
    expect(s.alive[civilians[1]]).toBe(false)
    expect(s.lastVote).toMatchObject({ eliminatedId: civilians[1], revealedRole: 'civilian' })
  })

  it('eliminates nobody when the day vote has a tie', () => {
    let s = fresh()
    const civilians = byRole(s, 'civilian')
    s = toVote(playNight(s, civilians[0], civilians[1], civilians[1]))
    const alive = s.players.filter((p) => s.alive[p.id]).map((p) => p.id)
    const [a, b] = alive
    s = input(s, alive[0], b)
    s = input(s, alive[1], a)
    s = input(s, alive[2], b)
    s = input(s, alive[3], a)
    s = input(s, alive[4], b)
    s = input(s, alive[5], a)
    expect(s.phase).toBe('reveal')
    expect(s.lastVote).toMatchObject({ eliminatedId: null, revealedRole: null })
    expect(Object.values(s.alive).filter(Boolean)).toHaveLength(alive.length)
  })

  it('rejects self-votes, unknown targets, non-living targets, and dead voters', () => {
    let s = fresh()
    const civilians = byRole(s, 'civilian')
    s = toVote(playNight(s, civilians[0], civilians[1], civilians[1]))
    const aliveVoter = s.players.find((p) => s.alive[p.id])!.id
    expect(input(s, aliveVoter, aliveVoter)).toBe(s)
    expect(input(s, aliveVoter, 'unknown')).toBe(s)
    expect(input(s, aliveVoter, civilians[0])).toBe(s)
    expect(input(s, civilians[0], aliveVoter)).toBe(s)
  })

  it('town wins after reveal when the final mafioso was eliminated', () => {
    let s = fresh()
    const [mafioso] = byRole(s, 'mafia')
    const civilians = byRole(s, 'civilian')
    s = toVote(playNight(s, civilians[0], civilians[1], mafioso))
    for (const voter of s.players.filter((p) => s.alive[p.id]).map((p) => p.id)) {
      s = input(s, voter, voter === mafioso ? civilians[1] : mafioso)
    }
    expect(s.phase).toBe('reveal')
    s = mafia.reducer(s, { type: 'HOST_ADVANCE', now: T0 })
    expect(s).toMatchObject({ phase: 'finished', winner: 'town', deadline: null })
  })

  it('mafia wins as soon as living mafia equal everyone else', () => {
    const four = players.slice(0, 4)
    let s = fresh(four)
    const [mafioso] = byRole(s, 'mafia')
    const nonMafia = four.map((p) => p.id).filter((id) => id !== mafioso)
    s = playNight(s, nonMafia[0], nonMafia[1], nonMafia[1])
    expect(s).toMatchObject({ phase: 'day', winner: null })
    s = toVote(s)
    const voters = four.filter((p) => s.alive[p.id]).map((p) => p.id)
    for (const voter of voters) s = input(s, voter, voter === nonMafia[1] ? mafioso : nonMafia[1])
    s = mafia.reducer(s, { type: 'HOST_ADVANCE', now: T0 })
    expect(s).toMatchObject({ phase: 'finished', winner: 'mafia', deadline: null })
  })

  it('timer paths skip missing actions and advance through every timed phase', () => {
    let s = fresh()
    s = mafia.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 45_000 })
    expect(s).toMatchObject({ phase: 'day', lastNight: { killedId: null, saved: false } })
    s = mafia.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 165_000 })
    expect(s).toMatchObject({ phase: 'vote', deadline: T0 + 210_000 })
    s = mafia.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 210_000 })
    expect(s).toMatchObject({
      phase: 'reveal',
      lastVote: { eliminatedId: null, revealedRole: null },
    })
    s = mafia.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 220_000 })
    expect(s).toMatchObject({ phase: 'night', day: 2, deadline: T0 + 265_000 })
  })

  it('updates connection state immutably and ignores unknown connection changes', () => {
    const s = fresh()
    const changed = connection(s, 'p1', false)
    expect(changed).not.toBe(s)
    expect(changed.players).not.toBe(s.players)
    expect(changed.players.find((p) => p.id === 'p1')?.connected).toBe(false)
    expect(s.players.find((p) => p.id === 'p1')?.connected).toBe(true)
    expect(connection(s, 'unknown', false)).toBe(s)
  })

  it('disconnecting the final missing night actor resolves only when connected actors remain', () => {
    let s = fresh()
    const [mafioso] = byRole(s, 'mafia')
    const [doctor] = byRole(s, 'doctor')
    const [detective] = byRole(s, 'detective')
    const civilians = byRole(s, 'civilian')
    s = input(s, mafioso, civilians[0])
    s = input(s, doctor, civilians[1])
    expect(s.phase).toBe('night')
    s = connection(s, detective, false, T0 + 1)
    expect(s.phase).toBe('day')

    let none = fresh()
    for (const player of none.players) none = connection(none, player.id, false)
    expect(none.phase).toBe('night')
  })

  it('reconnection reintroduces a living role-holder into night completion', () => {
    let s = fresh()
    const [mafioso] = byRole(s, 'mafia')
    const [doctor] = byRole(s, 'doctor')
    const [detective] = byRole(s, 'detective')
    const civilians = byRole(s, 'civilian')
    s = connection(s, detective, false)
    s = input(s, mafioso, civilians[0])
    s = connection(s, detective, true)
    s = input(s, doctor, civilians[1])
    expect(s.phase).toBe('night')
    s = input(s, detective, civilians[1])
    expect(s.phase).toBe('day')
  })

  it('disconnecting the final missing voter resolves only when connected voters remain', () => {
    let s = fresh()
    const civilians = byRole(s, 'civilian')
    s = toVote(playNight(s, civilians[0], civilians[1], civilians[1]))
    const alive = s.players.filter((p) => s.alive[p.id]).map((p) => p.id)
    for (const voter of alive.slice(0, -1)) {
      s = input(s, voter, voter === alive[0] ? alive[1] : alive[0])
    }
    expect(s.phase).toBe('vote')
    s = connection(s, alive.at(-1)!, false, T0 + 1)
    expect(s.phase).toBe('reveal')

    let none = fresh()
    none = mafia.reducer(none, { type: 'TIMER_EXPIRED', now: T0 })
    none = toVote(none)
    for (const player of none.players) none = connection(none, player.id, false)
    expect(none.phase).toBe('vote')
  })

  it('host progress counts only connected living night actors and voters', () => {
    let s = fresh()
    const [mafioso] = byRole(s, 'mafia')
    const [doctor] = byRole(s, 'doctor')
    const [detective] = byRole(s, 'detective')
    const civilians = byRole(s, 'civilian')
    s = connection(s, detective, false)
    s = input(s, mafioso, civilians[0])
    expect(mafia.hostView(s)).toMatchObject({ phase: 'night', actionsDone: 1, actionsNeeded: 2 })
    s = input(s, doctor, civilians[1])
    s = toVote(s)
    const aliveConnected = s.players.filter((p) => s.alive[p.id] && p.connected)
    expect(mafia.hostView(s)).toMatchObject({
      phase: 'vote',
      votedCount: 0,
      totalVoters: aliveConnected.length,
    })
  })

  it('does not count stale actions or votes from disconnected participants as done', () => {
    let s = fresh()
    const [mafioso] = byRole(s, 'mafia')
    const [doctor] = byRole(s, 'doctor')
    const [detective] = byRole(s, 'detective')
    const civilians = byRole(s, 'civilian')
    s = input(s, mafioso, civilians[0])
    s = connection(s, mafioso, false)
    expect(mafia.hostView(s)).toMatchObject({ phase: 'night', actionsDone: 0, actionsNeeded: 2 })
    s = input(s, doctor, civilians[1])
    s = input(s, detective, civilians[1])
    s = toVote(s)
    const voter = s.players.find((p) => s.alive[p.id] && p.connected)!.id
    const target = s.players.find((p) => s.alive[p.id] && p.id !== voter)!.id
    s = input(s, voter, target)
    s = connection(s, voter, false)
    expect(mafia.hostView(s)).toMatchObject({ phase: 'vote', votedCount: 0 })
  })

  it('does not expose living roles or hidden state in host and civilian views', () => {
    const s = fresh()
    const civilian = byRole(s, 'civilian')[0]
    const hostView = mafia.hostView(s) as Record<string, unknown>
    const civilianView = mafia.playerView(s, civilian) as Record<string, unknown>
    expect(Object.keys(hostView).sort()).toEqual(
      ['actionsDone', 'actionsNeeded', 'day', 'deadline', 'phase', 'players'].sort(),
    )
    expect(Object.keys(civilianView).sort()).toEqual(
      [
        'action',
        'candidates',
        'day',
        'deadline',
        'isAlive',
        'phase',
        'players',
        'role',
        'yourTarget',
      ].sort(),
    )
    expect(hostView).not.toHaveProperty('roles')
    expect(hostView).not.toHaveProperty('night')
    expect(hostView).not.toHaveProperty('votes')
    expect(civilianView).not.toHaveProperty('roles')
    expect(civilianView).not.toHaveProperty('mafiaTeam')
    expect(civilianView).not.toHaveProperty('detectiveLog')
  })

  it('reveals every role only after the game finishes', () => {
    const s = { ...fresh(), phase: 'finished' as const, winner: 'town' as const, deadline: null }
    const expected = s.players.map((p) => ({ nickname: p.nickname, role: s.roles[p.id] }))
    expect(mafia.hostView(s)).toMatchObject({
      phase: 'finished',
      winner: 'town',
      allRoles: expected,
    })
    expect(mafia.playerView(s, byRole(s, 'civilian')[0])).toMatchObject({
      phase: 'finished',
      winner: 'town',
      allRoles: expected,
    })
  })
})
