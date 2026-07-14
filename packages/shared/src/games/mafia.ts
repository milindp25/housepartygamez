import type { GameDefinition, GamePlayer, TimedState } from '../engine/types'

/** A secret role available in classic Mafia. */
export type MafiaRole = 'mafia' | 'doctor' | 'detective' | 'civilian'

/** Configurable durations for each timed Mafia phase, in seconds. */
export interface MafiaSettings {
  nightSeconds: number
  discussionSeconds: number
  voteSeconds: number
  revealSeconds: number
}

/** Mafia uses no prompt content; this type is never instantiated. */
export type MafiaPrompt = never

/** Complete authoritative state for a classic Mafia game. */
export interface MafiaState extends TimedState {
  phase: 'night' | 'day' | 'vote' | 'reveal' | 'finished'
  /** One-based day counter, incremented when a new night begins. */
  day: number
  players: GamePlayer[]
  roles: Record<string, MafiaRole>
  alive: Record<string, boolean>
  /** Current-night actions, cleared at dawn. */
  night: {
    mafiaVotes: Record<string, string>
    doctorSave: string | null
    detectiveCheck: string | null
  }
  lastNight: { killedId: string | null; saved: boolean } | null
  /** Investigation results that are surfaced only to the detective. */
  detectiveLog: Array<{ targetNickname: string; isMafia: boolean }>
  /** Current-day elimination votes. */
  votes: Record<string, string>
  lastVote: {
    eliminatedId: string | null
    revealedRole: MafiaRole | null
    tally: Array<{ nickname: string; count: number }>
  } | null
  winner: 'town' | 'mafia' | null
  seed: number
  settings: MafiaSettings
}

interface AlivePlayer {
  id: string
  nickname: string
  alive: boolean
}

interface BaseView {
  day: number
  players: AlivePlayer[]
}

/** Information visible to one Mafia participant. */
export type MafiaPlayerView = BaseView & {
  role: MafiaRole
  isAlive: boolean
  /** Mafia-only nicknames of the whole mafia team. */
  mafiaTeam?: string[]
  /** Detective-only investigation history. */
  detectiveLog?: Array<{ targetNickname: string; isMafia: boolean }>
} & (
    | {
        phase: 'night'
        action: 'kill' | 'save' | 'investigate' | null
        candidates: Array<{ id: string; nickname: string }>
        yourTarget: string | null
        deadline: number | null
      }
    | {
        phase: 'day'
        lastNight: { killedNickname: string | null; saved: boolean }
        deadline: number | null
      }
    | {
        phase: 'vote'
        candidates: Array<{ id: string; nickname: string }>
        yourVote: string | null
        deadline: number | null
      }
    | {
        phase: 'reveal'
        eliminatedNickname: string | null
        revealedRole: MafiaRole | null
        tally: Array<{ nickname: string; count: number }>
      }
    | {
        phase: 'finished'
        winner: 'town' | 'mafia'
        allRoles: Array<{ nickname: string; role: MafiaRole }>
      }
  )

/** Public information visible on the Mafia host screen. */
export type MafiaHostView = BaseView &
  (
    | { phase: 'night'; actionsDone: number; actionsNeeded: number; deadline: number | null }
    | {
        phase: 'day'
        lastNight: { killedNickname: string | null; saved: boolean }
        deadline: number | null
      }
    | { phase: 'vote'; votedCount: number; totalVoters: number; deadline: number | null }
    | {
        phase: 'reveal'
        eliminatedNickname: string | null
        revealedRole: MafiaRole | null
        tally: Array<{ nickname: string; count: number }>
      }
    | {
        phase: 'finished'
        winner: 'town' | 'mafia'
        allRoles: Array<{ nickname: string; role: MafiaRole }>
      }
  )

function hash(value: string): number {
  let result = 0
  for (let index = 0; index < value.length; index += 1) {
    result = (result * 31 + value.charCodeAt(index)) | 0
  }
  return result >>> 0
}

function assignRoles(players: GamePlayer[], seed: number): Record<string, MafiaRole> {
  const shuffled = [...players].sort((a, b) => {
    const difference = hash(a.id + seed) - hash(b.id + seed)
    return difference === 0 ? a.id.localeCompare(b.id) : difference
  })
  const mafiaCount = Math.max(1, Math.floor(players.length / 4))
  return Object.fromEntries(
    shuffled.map((player, index): [string, MafiaRole] => [
      player.id,
      index < mafiaCount
        ? 'mafia'
        : index === mafiaCount
          ? 'doctor'
          : index === mafiaCount + 1
            ? 'detective'
            : 'civilian',
    ]),
  )
}

function playerById(state: MafiaState, playerId: string): GamePlayer | undefined {
  return state.players.find((player) => player.id === playerId)
}

function nickname(state: MafiaState, playerId: string | null): string | null {
  return playerId === null ? null : (playerById(state, playerId)?.nickname ?? '?')
}

function livingPlayers(state: MafiaState): GamePlayer[] {
  return state.players.filter((player) => state.alive[player.id])
}

function connectedLivingPlayers(state: MafiaState): GamePlayer[] {
  return livingPlayers(state).filter((player) => player.connected)
}

function livingWithRole(state: MafiaState, role: MafiaRole): GamePlayer[] {
  return livingPlayers(state).filter((player) => state.roles[player.id] === role)
}

function connectedLivingWithRole(state: MafiaState, role: MafiaRole): GamePlayer[] {
  return connectedLivingPlayers(state).filter((player) => state.roles[player.id] === role)
}

function connectedNightActors(state: MafiaState): GamePlayer[] {
  return connectedLivingPlayers(state).filter((player) => state.roles[player.id] !== 'civilian')
}

function hasNightAction(state: MafiaState, player: GamePlayer): boolean {
  const role = state.roles[player.id]
  if (role === 'mafia') return state.night.mafiaVotes[player.id] !== undefined
  if (role === 'doctor') return state.night.doctorSave !== null
  if (role === 'detective') return state.night.detectiveCheck !== null
  return false
}

function nightComplete(state: MafiaState): boolean {
  const actors = connectedNightActors(state)
  return actors.length > 0 && actors.every((player) => hasNightAction(state, player))
}

function voteComplete(state: MafiaState): boolean {
  const voters = connectedLivingPlayers(state)
  return voters.length > 0 && voters.every((player) => state.votes[player.id] !== undefined)
}

function plurality(votes: Record<string, string>, seed: number): string | null {
  const counts = new Map<string, number>()
  for (const targetId of Object.values(votes)) counts.set(targetId, (counts.get(targetId) ?? 0) + 1)
  let best: string | null = null
  for (const [targetId, count] of counts) {
    const bestCount = best === null ? 0 : (counts.get(best) ?? 0)
    const targetHash = hash(targetId + seed)
    const bestHash = best === null ? 0 : hash(best + seed)
    if (
      best === null ||
      count > bestCount ||
      (count === bestCount &&
        (targetHash < bestHash || (targetHash === bestHash && targetId < best)))
    ) {
      best = targetId
    }
  }
  return best
}

function checkWinner(state: MafiaState): 'town' | 'mafia' | null {
  const mafiaAlive = livingWithRole(state, 'mafia').length
  const othersAlive = livingPlayers(state).length - mafiaAlive
  if (mafiaAlive === 0) return 'town'
  if (mafiaAlive >= othersAlive) return 'mafia'
  return null
}

function connectedMafiaVotes(state: MafiaState): Record<string, string> {
  return Object.fromEntries(
    connectedLivingWithRole(state, 'mafia').flatMap((player) => {
      const targetId = state.night.mafiaVotes[player.id]
      return targetId === undefined ? [] : [[player.id, targetId]]
    }),
  )
}

function resolveNight(state: MafiaState, now: number): MafiaState {
  const victim = plurality(connectedMafiaVotes(state), state.seed)
  const doctor = connectedLivingWithRole(state, 'doctor')[0]
  const save = doctor === undefined ? null : state.night.doctorSave
  const saved = victim !== null && victim === save
  const killedId = victim !== null && !saved ? victim : null
  const alive = { ...state.alive }
  if (killedId !== null) alive[killedId] = false

  const detectiveLog = [...state.detectiveLog]
  const detective = connectedLivingWithRole(state, 'detective')[0]
  if (detective !== undefined && state.night.detectiveCheck !== null) {
    detectiveLog.push({
      targetNickname: nickname(state, state.night.detectiveCheck) ?? '?',
      isMafia: state.roles[state.night.detectiveCheck] === 'mafia',
    })
  }

  const next: MafiaState = {
    ...state,
    alive,
    detectiveLog,
    lastNight: { killedId, saved },
    night: { mafiaVotes: {}, doctorSave: null, detectiveCheck: null },
    votes: {},
    phase: 'day',
    deadline: now + state.settings.discussionSeconds * 1000,
  }
  const winner = checkWinner(next)
  return winner === null ? next : { ...next, phase: 'finished', winner, deadline: null }
}

function connectedVotes(state: MafiaState): Record<string, string> {
  return Object.fromEntries(
    connectedLivingPlayers(state).flatMap((player) => {
      const targetId = state.votes[player.id]
      return targetId === undefined ? [] : [[player.id, targetId]]
    }),
  )
}

function resolveVote(state: MafiaState, now: number): MafiaState {
  const counts = new Map<string, number>()
  for (const targetId of Object.values(connectedVotes(state))) {
    counts.set(targetId, (counts.get(targetId) ?? 0) + 1)
  }
  const maximum = Math.max(0, ...counts.values())
  const leaders = [...counts.entries()]
    .filter(([, count]) => count === maximum)
    .map(([targetId]) => targetId)
  const eliminatedId = maximum > 0 && leaders.length === 1 ? leaders[0] : null
  const alive = { ...state.alive }
  if (eliminatedId !== null) alive[eliminatedId] = false

  return {
    ...state,
    alive,
    lastVote: {
      eliminatedId,
      revealedRole: eliminatedId === null ? null : state.roles[eliminatedId],
      tally: [...counts.entries()]
        .map(([targetId, count]) => ({ nickname: nickname(state, targetId) ?? '?', count }))
        .sort((a, b) => b.count - a.count || a.nickname.localeCompare(b.nickname)),
    },
    phase: 'reveal',
    deadline: now + state.settings.revealSeconds * 1000,
  }
}

function toNight(state: MafiaState, now: number): MafiaState {
  const winner = checkWinner(state)
  if (winner !== null) return { ...state, phase: 'finished', winner, deadline: null }
  return {
    ...state,
    phase: 'night',
    day: state.day + 1,
    votes: {},
    deadline: now + state.settings.nightSeconds * 1000,
  }
}

function baseView(state: MafiaState): BaseView {
  return {
    day: state.day,
    players: state.players.map((player) => ({
      id: player.id,
      nickname: player.nickname,
      alive: state.alive[player.id],
    })),
  }
}

function allRoles(state: MafiaState): Array<{ nickname: string; role: MafiaRole }> {
  return state.players.map((player) => ({
    nickname: player.nickname,
    role: state.roles[player.id],
  }))
}

function lastNightView(state: MafiaState): { killedNickname: string | null; saved: boolean } {
  return {
    killedNickname: nickname(state, state.lastNight?.killedId ?? null),
    saved: state.lastNight?.saved ?? false,
  }
}

function applyConnectionChange(
  state: MafiaState,
  playerId: string,
  connected: boolean,
  now: number,
): MafiaState {
  const player = playerById(state, playerId)
  if (player === undefined || player.connected === connected) return state
  const next: MafiaState = {
    ...state,
    players: state.players.map((candidate) =>
      candidate.id === playerId ? { ...candidate, connected } : candidate,
    ),
  }
  if (next.phase === 'night' && nightComplete(next)) return resolveNight(next, now)
  if (next.phase === 'vote' && voteComplete(next)) return resolveVote(next, now)
  return next
}

/** Classic Mafia rules with all hidden information enforced by its views. */
export const mafia: GameDefinition<MafiaState, MafiaSettings, MafiaPrompt> = {
  id: 'mafia',
  minPlayers: 4,
  defaultSettings: { nightSeconds: 45, discussionSeconds: 150, voteSeconds: 45, revealSeconds: 12 },

  init({ players: initialPlayers, settings, now }) {
    const players = initialPlayers.map((player) => ({ ...player }))
    return {
      phase: 'night',
      day: 1,
      players,
      roles: assignRoles(players, now),
      alive: Object.fromEntries(players.map((player) => [player.id, true])),
      night: { mafiaVotes: {}, doctorSave: null, detectiveCheck: null },
      lastNight: null,
      detectiveLog: [],
      votes: {},
      lastVote: null,
      winner: null,
      seed: now,
      settings: { ...settings },
      deadline: now + settings.nightSeconds * 1000,
    }
  },

  reducer(state, action): MafiaState {
    switch (action.type) {
      case 'PLAYER_INPUT': {
        const player = playerById(state, action.playerId)
        if (player === undefined || !player.connected || !state.alive[player.id]) return state
        const targetId = (action.input as { targetId?: unknown })?.targetId
        if (typeof targetId !== 'string' || !state.alive[targetId]) return state

        if (state.phase === 'night') {
          const role = state.roles[player.id]
          let night = state.night
          // Latest accepted input wins while the phase remains open; resolution closes it.
          if (role === 'mafia') {
            if (state.roles[targetId] === 'mafia') return state
            night = { ...night, mafiaVotes: { ...night.mafiaVotes, [player.id]: targetId } }
          } else if (role === 'doctor') {
            night = { ...night, doctorSave: targetId }
          } else if (role === 'detective') {
            if (targetId === player.id) return state
            night = { ...night, detectiveCheck: targetId }
          } else {
            return state
          }
          const next = { ...state, night }
          return nightComplete(next) ? resolveNight(next, action.now) : next
        }

        if (state.phase === 'vote') {
          if (targetId === player.id) return state
          // Votes remain revisable until the final connected voter resolves the phase.
          const next = { ...state, votes: { ...state.votes, [player.id]: targetId } }
          return voteComplete(next) ? resolveVote(next, action.now) : next
        }
        return state
      }
      case 'PLAYER_CONNECTION_CHANGED':
        return applyConnectionChange(state, action.playerId, action.connected, action.now)
      case 'TIMER_EXPIRED':
      case 'HOST_ADVANCE':
        if (state.phase === 'night') return resolveNight(state, action.now)
        if (state.phase === 'day') {
          return {
            ...state,
            phase: 'vote',
            deadline: action.now + state.settings.voteSeconds * 1000,
          }
        }
        if (state.phase === 'vote') return resolveVote(state, action.now)
        if (state.phase === 'reveal') return toNight(state, action.now)
        return state
    }
  },

  playerView(state, playerId): MafiaPlayerView {
    const player = playerById(state, playerId)
    const role = state.roles[playerId]
    if (player === undefined || role === undefined) {
      throw new Error(`Unknown Mafia player: ${playerId}`)
    }
    const canAct = state.alive[playerId] === true && player.connected
    const base = {
      ...baseView(state),
      role,
      isAlive: state.alive[playerId] === true,
      ...(role === 'mafia'
        ? {
            mafiaTeam: state.players
              .filter((player) => state.roles[player.id] === 'mafia')
              .map((player) => player.nickname),
          }
        : {}),
      ...(role === 'detective' ? { detectiveLog: [...state.detectiveLog] } : {}),
    }

    if (state.phase === 'night') {
      const action = !canAct
        ? null
        : role === 'mafia'
          ? ('kill' as const)
          : role === 'doctor'
            ? ('save' as const)
            : role === 'detective'
              ? ('investigate' as const)
              : null
      const candidates =
        action === null
          ? []
          : livingPlayers(state)
              .filter((player) => (role === 'mafia' ? state.roles[player.id] !== 'mafia' : true))
              .filter((player) => (role === 'detective' ? player.id !== playerId : true))
              .map((player) => ({ id: player.id, nickname: player.nickname }))
      const yourTarget = !canAct
        ? null
        : role === 'mafia'
          ? (state.night.mafiaVotes[playerId] ?? null)
          : role === 'doctor'
            ? state.night.doctorSave
            : role === 'detective'
              ? state.night.detectiveCheck
              : null
      return { ...base, phase: 'night', action, candidates, yourTarget, deadline: state.deadline }
    }
    if (state.phase === 'day') {
      return { ...base, phase: 'day', lastNight: lastNightView(state), deadline: state.deadline }
    }
    if (state.phase === 'vote') {
      return {
        ...base,
        phase: 'vote',
        candidates: canAct
          ? livingPlayers(state)
              .filter((candidate) => candidate.id !== playerId)
              .map((candidate) => ({ id: candidate.id, nickname: candidate.nickname }))
          : [],
        yourVote: canAct ? (state.votes[playerId] ?? null) : null,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        ...base,
        phase: 'reveal',
        eliminatedNickname: nickname(state, state.lastVote?.eliminatedId ?? null),
        revealedRole: state.lastVote?.revealedRole ?? null,
        tally: state.lastVote?.tally ?? [],
      }
    }
    return { ...base, phase: 'finished', winner: state.winner ?? 'town', allRoles: allRoles(state) }
  },

  hostView(state): MafiaHostView {
    const base = baseView(state)
    if (state.phase === 'night') {
      const actors = connectedNightActors(state)
      return {
        ...base,
        phase: 'night',
        actionsDone: actors.filter((player) => hasNightAction(state, player)).length,
        actionsNeeded: actors.length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'day') {
      return { ...base, phase: 'day', lastNight: lastNightView(state), deadline: state.deadline }
    }
    if (state.phase === 'vote') {
      const voters = connectedLivingPlayers(state)
      return {
        ...base,
        phase: 'vote',
        votedCount: voters.filter((player) => state.votes[player.id] !== undefined).length,
        totalVoters: voters.length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        ...base,
        phase: 'reveal',
        eliminatedNickname: nickname(state, state.lastVote?.eliminatedId ?? null),
        revealedRole: state.lastVote?.revealedRole ?? null,
        tally: state.lastVote?.tally ?? [],
      }
    }
    return { ...base, phase: 'finished', winner: state.winner ?? 'town', allRoles: allRoles(state) }
  },

  isFinished: (state) => state.phase === 'finished',
}
