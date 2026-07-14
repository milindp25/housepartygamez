# Plan 2: Round Engine + Would You Rather Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The generic round engine plus the first complete game — a host starts Would You Rather, players vote on their phones, the TV reveals the group split each round, and a final leaderboard shows who was "most in the majority".

**Architecture:** Game rules are pure `GameDefinition` objects (init/reducer/views) in `packages/shared`. `RoomManager` gains a game slot; the socket layer dispatches actions into the reducer and emits **personalized** views per socket (the info-hiding mechanism all later games rely on). Server-side timers dispatch `TIMER_EXPIRED` actions. Content lives in a new `@hpg/content` package as typed TS modules (JSON-shaped data, type-checked at build time).

**Tech Stack:** everything from plan 1, plus Playwright for e2e.

**Standards (apply to every task):** JSDoc on every exported function/class/type; inline comments explain *why*. pino JSON logging for every new server event (`game_started`, `game_input_rejected`, `game_phase_advanced`, `game_ended`). `pnpm lint` before every commit.

**Pre-flight:** plan 1 complete (`plan-1-platform-foundation` tag exists), `pnpm test` and `pnpm lint` green. Follow the Pre-flight rule in `docs/superpowers/plans/README.md`.

---

## File structure

```
packages/shared/src/
├── engine/
│   ├── types.ts                 # GameId, GameAction, TimedState, GameDefinition
│   ├── content.ts               # PackTone, ContentPack, pickPrompts (+ test)
│   └── content.test.ts
├── games/
│   ├── wouldYouRather.ts        # WyrState/Settings/Views + wouldYouRather definition
│   └── wouldYouRather.test.ts
├── protocol.ts                  # MODIFIED: game events + personalized RoomStateMsg
└── index.ts                     # MODIFIED: re-export engine + games
packages/content/
├── package.json                 # @hpg/content
├── tsconfig.json
└── src/
    ├── index.ts                 # pack registry: getPack(gameId, tone)
    └── wouldYouRather.ts        # family/friends/spicy starter packs
apps/game-server/src/
├── roomManager.ts               # MODIFIED: startGame/applyGameAction/endGame + per-recipient views
├── roomManager.test.ts          # MODIFIED: game lifecycle tests
├── timers.ts                    # RoomTimers: schedules TIMER_EXPIRED per room deadline
└── server.ts                    # MODIFIED: game:* events, personalized broadcast, timer wiring
apps/web/src/
├── components/Countdown.tsx     # shared deadline countdown pill
├── components/Leaderboard.tsx   # shared final-scores list
├── components/host/WyrHost.tsx  # TV rendering of WyrHostView
├── components/play/WyrPlay.tsx  # phone rendering of WyrPlayerView
├── app/host/page.tsx            # MODIFIED: start-game controls + game rendering
└── app/join/page.tsx            # MODIFIED: game rendering
apps/web/e2e/
├── playwright.config.ts
└── would-you-rather.spec.ts
```

---

### Task 1: Engine types

**Files:**
- Create: `packages/shared/src/engine/types.ts`
- Modify: `packages/shared/src/index.ts`

- [x] **Step 1: Write the types**

`packages/shared/src/engine/types.ts`:
```ts
/** All games the platform knows about (spec catalog; only some are built so far). */
export type GameId = 'would-you-rather' | 'most-likely-to' | 'never-have-i-ever' | 'who-said-that'

/** A seated participant as the engine sees them. */
export interface GamePlayer {
  id: string
  nickname: string
  connected: boolean
}

/**
 * Everything that can change a game's state. Reducers are pure: same
 * state + action always produces the same next state. `now` is passed in
 * (never read from Date.now inside a reducer) so tests control time.
 */
export type GameAction =
  | { type: 'PLAYER_INPUT'; playerId: string; input: unknown; now: number }
  | { type: 'TIMER_EXPIRED'; now: number }
  | { type: 'HOST_ADVANCE'; now: number }

/**
 * Every game state exposes `deadline` (epoch ms, or null when waiting on the
 * host). The server watches it and dispatches TIMER_EXPIRED when it passes —
 * reducers never own timers.
 */
export interface TimedState {
  deadline: number | null
}

/**
 * A game is data + pure functions. The server hosts definitions generically:
 * it never contains game rules, and clients only ever see view objects.
 * `playerView` is the info-hiding boundary — a player's socket receives
 * exactly what that player may see, nothing more.
 */
export interface GameDefinition<State extends TimedState, Settings, Prompt> {
  id: GameId
  minPlayers: number
  /** Per-game cap; when set, startGame rejects larger lobbies (the room-wide entitlement cap still applies). */
  maxPlayers?: number
  defaultSettings: Settings
  init(args: { players: GamePlayer[]; prompts: Prompt[]; settings: Settings; now: number }): State
  reducer(state: State, action: GameAction): State
  playerView(state: State, playerId: string): unknown
  hostView(state: State): unknown
  isFinished(state: State): boolean
}

/**
 * Type-erased definition for generic storage (RoomManager treats all games
 * uniformly; concrete types are enforced at each game's module boundary).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyGameDefinition = GameDefinition<any, any, any>
```

Append to `packages/shared/src/index.ts`:
```ts
export * from './engine/types'
```

- [x] **Step 2: Verify compile, commit**

Run: `pnpm --filter @hpg/shared exec tsc --noEmit` → exit 0.
```bash
git add packages/shared/src && git commit -m "feat: engine types — GameDefinition, GameAction, TimedState"
```

---

### Task 2: Content types + pickPrompts (TDD)

**Files:**
- Create: `packages/shared/src/engine/content.ts`
- Test: `packages/shared/src/engine/content.test.ts`
- Modify: `packages/shared/src/index.ts`

- [x] **Step 1: Write the failing test**

`packages/shared/src/engine/content.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { ContentPack } from './content'
import { pickPrompts } from './content'

const pack: ContentPack<{ id: string }> = {
  id: 'test',
  game: 'would-you-rather',
  tone: 'friends',
  locale: 'en',
  prompts: [{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }, { id: 'p4' }],
}

describe('pickPrompts', () => {
  it('returns the requested count without duplicates', () => {
    const picked = pickPrompts(pack, 3, () => 0.5)
    expect(picked).toHaveLength(3)
    expect(new Set(picked.map((p) => p.id)).size).toBe(3)
  })

  it('caps at pack size when asking for more than available', () => {
    expect(pickPrompts(pack, 10, () => 0.5)).toHaveLength(4)
  })

  it('is deterministic given an injected RNG', () => {
    const a = pickPrompts(pack, 4, () => 0.1)
    const b = pickPrompts(pack, 4, () => 0.1)
    expect(a).toEqual(b)
  })
})
```

- [x] **Step 2: Run to verify FAIL** — `pnpm --filter @hpg/shared test` (cannot resolve `./content`).

- [x] **Step 3: Implement**

`packages/shared/src/engine/content.ts`:
```ts
import type { GameId } from './types'

export type PackTone = 'family' | 'friends' | 'spicy'

/** A question pack. Built-in packs live in @hpg/content; custom packs use the same shape. */
export interface ContentPack<Prompt> {
  id: string
  game: GameId
  tone: PackTone
  locale: 'en'
  prompts: Prompt[]
}

/**
 * Selects `count` random prompts (Fisher–Yates shuffle then slice).
 * RNG is injectable so games are reproducible in tests.
 */
export function pickPrompts<P>(
  pack: ContentPack<P>,
  count: number,
  random: () => number = Math.random,
): P[] {
  const pool = [...pack.prompts]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, Math.min(count, pool.length))
}
```

Append to `packages/shared/src/index.ts`: `export * from './engine/content'`

- [x] **Step 4: Run to verify PASS, lint, commit**

```bash
pnpm --filter @hpg/shared test && pnpm lint
git add packages/shared/src && git commit -m "feat: content pack types and prompt picker"
```

---

### Task 3: Would You Rather definition (TDD)

**Files:**
- Create: `packages/shared/src/games/wouldYouRather.ts`
- Test: `packages/shared/src/games/wouldYouRather.test.ts`
- Modify: `packages/shared/src/index.ts`

- [x] **Step 1: Write the failing tests**

`packages/shared/src/games/wouldYouRather.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { GamePlayer } from '../engine/types'
import type { WyrPlayerView, WyrState } from './wouldYouRather'
import { wouldYouRather } from './wouldYouRather'

const players: GamePlayer[] = [
  { id: 'p1', nickname: 'Ana', connected: true },
  { id: 'p2', nickname: 'Ben', connected: true },
  { id: 'p3', nickname: 'Cy', connected: true },
]
const prompts = [
  { id: 'q1', a: 'Fly', b: 'Be invisible' },
  { id: 'q2', a: 'Beach', b: 'Mountains' },
]
const settings = { rounds: 2, voteSeconds: 30, revealSeconds: 8 }
const T0 = 1_000_000

function fresh(): WyrState {
  return wouldYouRather.init({ players, prompts, settings, now: T0 })
}
function vote(s: WyrState, playerId: string, choice: 'a' | 'b', now = T0): WyrState {
  return wouldYouRather.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { choice }, now })
}

describe('would-you-rather', () => {
  it('starts round 1 in vote phase with a deadline', () => {
    const s = fresh()
    expect(s.phase).toBe('vote')
    expect(s.round).toBe(1)
    expect(s.deadline).toBe(T0 + 30_000)
  })

  it('records votes and lets a player change their vote until reveal', () => {
    let s = vote(fresh(), 'p1', 'a')
    s = vote(s, 'p1', 'b')
    expect(s.votes[0].p1).toBe('b')
    expect(s.phase).toBe('vote') // not everyone voted yet
  })

  it('reveals automatically once every connected player voted', () => {
    let s = vote(fresh(), 'p1', 'a')
    s = vote(s, 'p2', 'a')
    s = vote(s, 'p3', 'b', T0 + 5000)
    expect(s.phase).toBe('reveal')
    expect(s.deadline).toBe(T0 + 5000 + 8000)
  })

  it('does not wait for disconnected players', () => {
    const disconnected = [...players]
    disconnected[2] = { ...players[2], connected: false }
    let s = wouldYouRather.init({ players: disconnected, prompts, settings, now: T0 })
    s = vote(s, 'p1', 'a')
    s = vote(s, 'p2', 'b')
    expect(s.phase).toBe('reveal')
  })

  it('awards a point to majority voters, none on a tie', () => {
    let s = vote(fresh(), 'p1', 'a')
    s = vote(s, 'p2', 'a')
    s = vote(s, 'p3', 'b')
    expect(s.scores).toEqual({ p1: 1, p2: 1, p3: 0 })
  })

  it('timer expiry in vote phase reveals with whoever voted', () => {
    let s = vote(fresh(), 'p1', 'a')
    s = wouldYouRather.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 30_000 })
    expect(s.phase).toBe('reveal')
  })

  it('advances rounds and finishes after the last reveal', () => {
    let s = fresh()
    for (const p of ['p1', 'p2', 'p3']) s = vote(s, p, 'a')
    s = wouldYouRather.reducer(s, { type: 'HOST_ADVANCE', now: T0 + 10_000 })
    expect(s.phase).toBe('vote')
    expect(s.round).toBe(2)
    for (const p of ['p1', 'p2', 'p3']) s = vote(s, p, 'b', T0 + 11_000)
    s = wouldYouRather.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 20_000 })
    expect(s.phase).toBe('finished')
    expect(wouldYouRather.isFinished(s)).toBe(true)
  })

  it('rejects input in the wrong phase and from unknown players', () => {
    let s = fresh()
    for (const p of ['p1', 'p2', 'p3']) s = vote(s, p, 'a')
    const inReveal = vote(s, 'p1', 'b') // reveal phase: ignored
    expect(inReveal).toEqual(s)
    expect(vote(fresh(), 'ghost', 'a')).toEqual(fresh())
  })

  it('playerView hides other votes during vote phase, shows counts at reveal', () => {
    let s = vote(fresh(), 'p1', 'a')
    const viewP2 = wouldYouRather.playerView(s, 'p2') as WyrPlayerView
    expect(viewP2).toEqual({
      phase: 'vote',
      round: 1,
      totalRounds: 2,
      prompt: prompts[0],
      yourChoice: null,
      deadline: T0 + 30_000,
    })
    s = vote(s, 'p2', 'a')
    s = vote(s, 'p3', 'b')
    const reveal = wouldYouRather.playerView(s, 'p3') as WyrPlayerView
    expect(reveal).toMatchObject({ phase: 'reveal', counts: { a: 2, b: 1 }, majority: 'a', yourChoice: 'b' })
  })
})
```

- [x] **Step 2: Run to verify FAIL** — `pnpm --filter @hpg/shared test`.

- [x] **Step 3: Implement**

`packages/shared/src/games/wouldYouRather.ts`:
```ts
import type { GameAction, GameDefinition, GamePlayer, TimedState } from '../engine/types'

export interface WyrPrompt {
  id: string
  a: string
  b: string
}

export interface WyrSettings {
  rounds: number
  voteSeconds: number
  revealSeconds: number
}

export type WyrChoice = 'a' | 'b'

export interface WyrState extends TimedState {
  phase: 'vote' | 'reveal' | 'finished'
  round: number // 1-based
  prompts: WyrPrompt[]
  players: GamePlayer[]
  /** votes[roundIndex][playerId] = choice */
  votes: Array<Record<string, WyrChoice>>
  /** playerId -> times they voted with the majority */
  scores: Record<string, number>
  settings: WyrSettings
}

interface LeaderboardRow {
  playerId: string
  nickname: string
  score: number
}

export type WyrPlayerView =
  | {
      phase: 'vote'
      round: number
      totalRounds: number
      prompt: WyrPrompt
      yourChoice: WyrChoice | null
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      prompt: WyrPrompt
      counts: { a: number; b: number }
      yourChoice: WyrChoice | null
      majority: WyrChoice | 'tie'
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[] }

export type WyrHostView =
  | {
      phase: 'vote'
      round: number
      totalRounds: number
      prompt: WyrPrompt
      votedCount: number
      totalPlayers: number
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      prompt: WyrPrompt
      counts: { a: number; b: number }
      majority: WyrChoice | 'tie'
      leaderboard: LeaderboardRow[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[] }

/** Players who count toward "everyone voted" — the game never waits on a dropped phone. */
function activePlayers(state: WyrState): GamePlayer[] {
  return state.players.filter((p) => p.connected)
}

function currentVotes(state: WyrState): Record<string, WyrChoice> {
  return state.votes[state.round - 1] ?? {}
}

function counts(state: WyrState): { a: number; b: number } {
  const votes = Object.values(currentVotes(state))
  return { a: votes.filter((v) => v === 'a').length, b: votes.filter((v) => v === 'b').length }
}

function majority(state: WyrState): WyrChoice | 'tie' {
  const c = counts(state)
  return c.a === c.b ? 'tie' : c.a > c.b ? 'a' : 'b'
}

/** Close voting: score the majority, move to reveal with an auto-advance deadline. */
function toReveal(state: WyrState, now: number): WyrState {
  const win = majority(state)
  const scores = { ...state.scores }
  if (win !== 'tie') {
    for (const [playerId, choice] of Object.entries(currentVotes(state))) {
      if (choice === win) scores[playerId] = (scores[playerId] ?? 0) + 1
    }
  }
  return { ...state, phase: 'reveal', scores, deadline: now + state.settings.revealSeconds * 1000 }
}

/** Leave reveal: next round's vote, or finish after the last round. */
function advance(state: WyrState, now: number): WyrState {
  if (state.round >= state.settings.rounds) return { ...state, phase: 'finished', deadline: null }
  return {
    ...state,
    phase: 'vote',
    round: state.round + 1,
    votes: [...state.votes, {}],
    deadline: now + state.settings.voteSeconds * 1000,
  }
}

function leaderboard(state: WyrState): LeaderboardRow[] {
  return state.players
    .map((p) => ({ playerId: p.id, nickname: p.nickname, score: state.scores[p.id] ?? 0 }))
    .sort((x, y) => y.score - x.score)
}

/**
 * Would You Rather: N rounds of secret A/B voting with a group-split reveal.
 * "Score" = how often you voted with the majority (a fun stat, not a competition).
 */
export const wouldYouRather: GameDefinition<WyrState, WyrSettings, WyrPrompt> = {
  id: 'would-you-rather',
  minPlayers: 2,
  defaultSettings: { rounds: 10, voteSeconds: 30, revealSeconds: 8 },

  init({ players, prompts, settings, now }) {
    return {
      phase: 'vote',
      round: 1,
      prompts,
      players,
      votes: [{}],
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      settings: { ...settings, rounds: Math.min(settings.rounds, prompts.length) },
      deadline: now + settings.voteSeconds * 1000,
    }
  },

  reducer(state, action: GameAction): WyrState {
    switch (action.type) {
      case 'PLAYER_INPUT': {
        // Votes are only valid during the vote phase, from seated players, with a real choice.
        if (state.phase !== 'vote') return state
        if (!state.players.some((p) => p.id === action.playerId)) return state
        const input = action.input as { choice?: unknown }
        if (input?.choice !== 'a' && input?.choice !== 'b') return state

        const votes = [...state.votes]
        votes[state.round - 1] = { ...currentVotes(state), [action.playerId]: input.choice }
        const next = { ...state, votes }
        const everyoneVoted = activePlayers(next).every((p) => votes[state.round - 1][p.id])
        return everyoneVoted ? toReveal(next, action.now) : next
      }
      case 'TIMER_EXPIRED':
      case 'HOST_ADVANCE': {
        if (state.phase === 'vote') return toReveal(state, action.now)
        if (state.phase === 'reveal') return advance(state, action.now)
        return state
      }
    }
  },

  playerView(state, playerId): WyrPlayerView {
    const prompt = state.prompts[state.round - 1]
    if (state.phase === 'vote') {
      return {
        phase: 'vote',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        yourChoice: currentVotes(state)[playerId] ?? null,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        counts: counts(state),
        yourChoice: currentVotes(state)[playerId] ?? null,
        majority: majority(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  hostView(state): WyrHostView {
    const prompt = state.prompts[state.round - 1]
    if (state.phase === 'vote') {
      return {
        phase: 'vote',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        votedCount: Object.keys(currentVotes(state)).length,
        totalPlayers: activePlayers(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        counts: counts(state),
        majority: majority(state),
        leaderboard: leaderboard(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  isFinished(state) {
    return state.phase === 'finished'
  },
}
```

Append to `packages/shared/src/index.ts`: `export * from './games/wouldYouRather'`

- [x] **Step 4: Run to verify PASS, lint, commit**

```bash
pnpm --filter @hpg/shared test && pnpm lint
git add packages/shared/src && git commit -m "feat: would-you-rather game definition with majority scoring"
```

---

### Task 4: Content package with starter packs

**Files:**
- Create: `packages/content/package.json`, `packages/content/tsconfig.json`
- Create: `packages/content/src/wouldYouRather.ts`, `packages/content/src/index.ts`

- [x] **Step 1: Create the package**

`packages/content/package.json`:
```json
{
  "name": "@hpg/content",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "@hpg/shared": "workspace:*" },
  "devDependencies": { "typescript": "^5.7.0" }
}
```

`packages/content/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

- [x] **Step 2: Write the starter packs** (10 prompts per tone now; content expansion to 100+ is a plan-5 task)

`packages/content/src/wouldYouRather.ts`:
```ts
import type { ContentPack, WyrPrompt } from '@hpg/shared'

/** Starter packs — intentionally small; plan 5 expands each to 100+. */
export const wyrFamily: ContentPack<WyrPrompt> = {
  id: 'wyr-family-v1',
  game: 'would-you-rather',
  tone: 'family',
  locale: 'en',
  prompts: [
    { id: 'wyr-fam-1', a: 'Be able to fly', b: 'Be able to turn invisible' },
    { id: 'wyr-fam-2', a: 'Talk to animals', b: 'Speak every human language' },
    { id: 'wyr-fam-3', a: 'Never do homework again', b: 'Never do chores again' },
    { id: 'wyr-fam-4', a: 'Live in a treehouse', b: 'Live in a castle' },
    { id: 'wyr-fam-5', a: 'Only eat pizza forever', b: 'Only eat ice cream forever' },
    { id: 'wyr-fam-6', a: 'Have a pet dragon', b: 'Have a pet dinosaur' },
    { id: 'wyr-fam-7', a: 'Be 10 minutes early everywhere', b: 'Get 10 extra minutes of sleep daily' },
    { id: 'wyr-fam-8', a: 'Have a trampoline floor at home', b: 'Have a waterslide instead of stairs' },
    { id: 'wyr-fam-9', a: 'Always have to sing instead of talk', b: 'Always have to dance while walking' },
    { id: 'wyr-fam-10', a: 'Visit the past', b: 'Visit the future' },
  ],
}

export const wyrFriends: ContentPack<WyrPrompt> = {
  id: 'wyr-friends-v1',
  game: 'would-you-rather',
  tone: 'friends',
  locale: 'en',
  prompts: [
    { id: 'wyr-fri-1', a: 'Always be 10 minutes late', b: 'Always be 20 minutes early' },
    { id: 'wyr-fri-2', a: 'Free flights for life', b: 'Free food for life' },
    { id: 'wyr-fri-3', a: 'Lose your phone for a month', b: 'Lose your wallet every week' },
    { id: 'wyr-fri-4', a: 'Always say exactly what you think', b: 'Never be able to complain again' },
    { id: 'wyr-fri-5', a: 'Be famous but always broke', b: 'Be rich but totally unknown' },
    { id: 'wyr-fri-6', a: 'Have your group chat leaked', b: 'Have your search history leaked' },
    { id: 'wyr-fri-7', a: 'Re-live one year of your life', b: 'Skip one year into the future' },
    { id: 'wyr-fri-8', a: 'Never wait in line again', b: 'Never hit traffic again' },
    { id: 'wyr-fri-9', a: 'Only whisper forever', b: 'Only shout forever' },
    { id: 'wyr-fri-10', a: 'Fight one horse-sized duck', b: 'Fight a hundred duck-sized horses' },
  ],
}

export const wyrSpicy: ContentPack<WyrPrompt> = {
  id: 'wyr-spicy-v1',
  game: 'would-you-rather',
  tone: 'spicy',
  locale: 'en',
  prompts: [
    { id: 'wyr-spi-1', a: 'Have your DMs read aloud here', b: 'Have your camera roll shown here' },
    { id: 'wyr-spi-2', a: 'Get back with an ex', b: 'Stay single for five years' },
    { id: 'wyr-spi-3', a: 'Date someone 15 years older', b: 'Date someone your parents pick' },
    { id: 'wyr-spi-4', a: 'Accidentally text your crush', b: 'Accidentally text your boss' },
    { id: 'wyr-spi-5', a: 'Know who has a crush on you', b: 'Know what your ex says about you' },
    { id: 'wyr-spi-6', a: 'Go on a blind date picked by this group', b: 'Let this group read your last 10 texts' },
    { id: 'wyr-spi-7', a: 'Never flirt again', b: 'Flirt with everyone, always, badly' },
    { id: 'wyr-spi-8', a: 'Marry rich without love', b: 'Marry broke with love' },
    { id: 'wyr-spi-9', a: 'Have every date livestreamed', b: 'Have your mom on every first date' },
    { id: 'wyr-spi-10', a: 'Confess to your current crush tonight', b: 'Call an ex right now on speaker' },
  ],
}
```

`packages/content/src/index.ts`:
```ts
import type { ContentPack, GameId, PackTone } from '@hpg/shared'
import { wyrFamily, wyrFriends, wyrSpicy } from './wouldYouRather'

export * from './wouldYouRather'

/** Registry of built-in packs. Plans 3+ add the other games here. */
const registry: Partial<Record<GameId, Partial<Record<PackTone, ContentPack<unknown>>>>> = {
  'would-you-rather': { family: wyrFamily, friends: wyrFriends, spicy: wyrSpicy },
}

/** Looks up a built-in pack; undefined when the game/tone combination doesn't exist yet. */
export function getPack(game: GameId, tone: PackTone): ContentPack<unknown> | undefined {
  return registry[game]?.[tone]
}
```

- [x] **Step 3: Install, compile, commit**

```bash
pnpm install
pnpm --filter @hpg/content exec tsc --noEmit
pnpm lint
git add packages/content pnpm-lock.yaml && git commit -m "feat: content package with would-you-rather starter packs"
```

---

### Task 5: Protocol additions

**Files:**
- Modify: `packages/shared/src/protocol.ts`

- [x] **Step 1: Extend the protocol**

In `packages/shared/src/protocol.ts`, add the imports and replace/extend as follows (keep `PlayerInfo`, `JoinResult`, `WatchResult` as-is; `RoomView` becomes `RoomStateMsg` — update the two existing references in `JoinResult`/`WatchResult`):

```ts
import type { GameId } from './engine/types'
import type { PackTone } from './engine/content'

/**
 * The per-recipient room snapshot. When a game is running, `game.view` is
 * PERSONALIZED (playerView for players, hostView for host screens) — two
 * sockets in the same room receive different payloads. This is the
 * info-hiding mechanism for all hidden-information games.
 */
export interface RoomStateMsg {
  code: string
  phase: 'lobby' | 'game'
  players: PlayerInfo[]
  game?: { id: GameId; view: unknown }
}

export type StartGameResult = { ok: true } | { ok: false; error: string }

export interface ClientToServerEvents {
  'room:create': (ack: (res: { code: string }) => void) => void
  'room:watch': (payload: { code: string }, ack: (res: WatchResult) => void) => void
  'room:join': (
    payload: { code: string; nickname: string; playerToken: string },
    ack: (res: JoinResult) => void,
  ) => void
  /** Host starts a game for the current lobby. */
  'game:start': (
    payload: { gameId: GameId; tone: PackTone; rounds?: number },
    ack: (res: StartGameResult) => void,
  ) => void
  /** A player submits game input (shape is game-specific, validated by the reducer). */
  'game:input': (payload: { input: unknown }, ack: (res: StartGameResult) => void) => void
  /** Host skips ahead (e.g. everyone's done reading the reveal). */
  'game:advance': () => void
  /** Host ends the game and returns the room to the lobby. */
  'game:end': () => void
}

export interface ServerToClientEvents {
  'room:state': (msg: RoomStateMsg) => void
}
```

Update `JoinResult`/`WatchResult` to carry `RoomStateMsg` instead of `RoomView`, e.g. `{ ok: true; playerId: string; view: RoomStateMsg }`.

- [x] **Step 2: Fix compile fallout**

`RoomView` was renamed — update `roomManager.ts` (`toView` return type) and both web pages' imports. Run at repo root: `pnpm -r exec tsc --noEmit` until clean (mechanical renames only).

- [x] **Step 3: Test, lint, commit**

```bash
pnpm test && pnpm lint
git add -A && git commit -m "feat: protocol v2 — game events and personalized RoomStateMsg"
```

---

### Task 6: RoomManager game lifecycle (TDD)

**Files:**
- Modify: `apps/game-server/src/roomManager.ts`
- Test: `apps/game-server/src/roomManager.test.ts` (append)

- [x] **Step 1: Write the failing tests** (append to the existing describe block's file)

```ts
import { wouldYouRather } from '@hpg/shared'

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
      rooms.startGame(solo.code, wouldYouRather, [{ id: 'q1', a: 'A', b: 'B' }], wouldYouRather.defaultSettings),
    ).toEqual({ error: 'Need at least 2 players' })

    const room = seatedRoom(rooms)
    rooms.startGame(room.code, wouldYouRather, [{ id: 'q1', a: 'A', b: 'B' }], wouldYouRather.defaultSettings)
    expect(
      rooms.startGame(room.code, wouldYouRather, [{ id: 'q1', a: 'A', b: 'B' }], wouldYouRather.defaultSettings),
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
    rooms.startGame(room.code, wouldYouRather, [{ id: 'q1', a: 'A', b: 'B' }], wouldYouRather.defaultSettings)
    rooms.endGame(room.code)
    expect(rooms.toHostState(room).phase).toBe('lobby')
    expect(rooms.toHostState(room).game).toBeUndefined()
  })
})
```

- [x] **Step 2: Run to verify FAIL**, then implement.

Modify `apps/game-server/src/roomManager.ts` — add to `Room`:
```ts
import type { AnyGameDefinition, GameAction, RoomStateMsg, TimedState } from '@hpg/shared'

export interface ActiveGame {
  definition: AnyGameDefinition
  state: TimedState
}

export interface Room {
  code: string
  players: RoomPlayer[]
  lastActivityAt: number
  game?: ActiveGame
}
```

Add methods to `RoomManager` (and replace `toView` with the two personalized builders; keep a private `baseMsg`):
```ts
  /** Looks up a seated player by device token (used to map sockets to players). */
  playerByToken(code: string, token: string): RoomPlayer | undefined {
    return this.getRoom(code)?.players.find((p) => p.token === token)
  }

  /**
   * Starts a game for the currently seated players. Fails (never throws) when
   * the room is missing, a game is already running, or the lobby is too small.
   */
  startGame(
    code: string,
    definition: AnyGameDefinition,
    prompts: unknown[],
    settings: unknown,
  ): { room: Room } | { error: string } {
    const room = this.getRoom(code)
    if (!room) return { error: 'Room not found' }
    if (room.game) return { error: 'Game already running' }
    if (room.players.length < definition.minPlayers) {
      return { error: `Need at least ${definition.minPlayers} players` }
    }
    if (definition.maxPlayers !== undefined && room.players.length > definition.maxPlayers) {
      return { error: `This game supports at most ${definition.maxPlayers} players` }
    }
    room.lastActivityAt = this.now()
    const players = room.players.map(({ id, nickname, connected }) => ({ id, nickname, connected }))
    room.game = {
      definition,
      state: definition.init({ players, prompts, settings, now: this.now() }),
    }
    return { room }
  }

  /** Runs one action through the game's reducer. No-op when no game is running. */
  applyGameAction(code: string, action: GameAction): Room | undefined {
    const room = this.getRoom(code)
    if (!room?.game) return undefined
    room.lastActivityAt = this.now()
    room.game.state = room.game.definition.reducer(room.game.state, action)
    return room
  }

  /** Ends the game (host action or natural finish acknowledged) — back to lobby. */
  endGame(code: string): Room | undefined {
    const room = this.getRoom(code)
    if (!room) return undefined
    room.lastActivityAt = this.now()
    delete room.game
    return room
  }

  private baseMsg(room: Room): Omit<RoomStateMsg, 'game' | 'phase'> {
    return {
      code: room.code,
      players: room.players.map(({ id, nickname, connected }) => ({ id, nickname, connected })),
    }
  }

  /** Snapshot for host screens (public info + hostView). */
  toHostState(room: Room): RoomStateMsg {
    if (!room.game) return { ...this.baseMsg(room), phase: 'lobby' }
    return {
      ...this.baseMsg(room),
      phase: 'game',
      game: { id: room.game.definition.id, view: room.game.definition.hostView(room.game.state) },
    }
  }

  /** Snapshot for one player's phone (public info + THEIR playerView only). */
  toPlayerState(room: Room, token: string): RoomStateMsg | undefined {
    const player = room.players.find((p) => p.token === token)
    if (!player) return undefined
    if (!room.game) return { ...this.baseMsg(room), phase: 'lobby' }
    return {
      ...this.baseMsg(room),
      phase: 'game',
      game: { id: room.game.definition.id, view: room.game.definition.playerView(room.game.state, player.id) },
    }
  }
```

Update `server.ts` call sites of the removed `toView` minimally to compile (`toHostState`) — full rewiring is Task 7.

- [x] **Step 3: Run to verify PASS, lint, commit**

```bash
pnpm --filter @hpg/game-server test && pnpm lint
git add apps/game-server/src && git commit -m "feat: RoomManager game lifecycle with personalized state builders"
```

---

### Task 7: Server game events + timers (TDD integration)

**Files:**
- Create: `apps/game-server/src/timers.ts`
- Modify: `apps/game-server/src/server.ts`
- Test: `apps/game-server/src/server.test.ts` (append)

- [x] **Step 1: Write the failing integration test** (append)

```ts
describe('game flow over sockets', () => {
  it('host starts WYR, players vote, reveal broadcasts, host ends game', async () => {
    const host = client()
    const { code } = await host.emitWithAck('room:create')
    const p1 = client()
    const p2 = client()
    await p1.emitWithAck('room:join', { code, nickname: 'Ana', playerToken: 'g-tok-1' })
    await p2.emitWithAck('room:join', { code, nickname: 'Ben', playerToken: 'g-tok-2' })

    const hostGameState = nextState(host)
    const started = await host.emitWithAck('game:start', {
      gameId: 'would-you-rather',
      tone: 'friends',
      rounds: 1,
    })
    expect(started).toEqual({ ok: true })
    const hostMsg = await hostGameState
    expect(hostMsg.phase).toBe('game')
    expect(hostMsg.game?.view).toMatchObject({ phase: 'vote', votedCount: 0, totalPlayers: 2 })

    await p1.emitWithAck('game:input', { input: { choice: 'a' } })
    const revealAtHost = nextState(host)
    const revealAtP2 = nextState(p2)
    await p2.emitWithAck('game:input', { input: { choice: 'a' } })
    expect((await revealAtHost).game?.view).toMatchObject({ phase: 'reveal', counts: { a: 2, b: 0 } })
    expect((await revealAtP2).game?.view).toMatchObject({ phase: 'reveal', yourChoice: 'a' })

    const backToLobby = nextState(p1)
    host.emit('game:end')
    expect((await backToLobby).phase).toBe('lobby')
  })

  it('players cannot start games; only the host can', async () => {
    const host = client()
    const { code } = await host.emitWithAck('room:create')
    const p1 = client()
    await p1.emitWithAck('room:join', { code, nickname: 'Ana', playerToken: 'g-tok-3' })
    const res = await p1.emitWithAck('game:start', { gameId: 'would-you-rather', tone: 'friends' })
    expect(res).toEqual({ ok: false, error: 'Only the host can start a game' })
  })
})
```

(`nextState`'s type changes from `RoomView` to `RoomStateMsg` — update the helper.)

- [x] **Step 2: Run to verify FAIL**, then implement.

`apps/game-server/src/timers.ts`:
```ts
/**
 * One pending TIMER_EXPIRED per room. Reducers own deadlines; this class owns
 * setTimeout handles — reschedule() diffs the room's current deadline against
 * what's scheduled and (re)arms or clears accordingly. Centralizing handles
 * here means room deletion can never leak a timer.
 */
export class RoomTimers {
  private handles = new Map<string, { deadline: number; handle: NodeJS.Timeout }>()

  reschedule(code: string, deadline: number | null, onExpire: () => void): void {
    const existing = this.handles.get(code)
    if (existing && existing.deadline === deadline) return
    if (existing) clearTimeout(existing.handle)
    this.handles.delete(code)
    if (deadline === null) return
    const handle = setTimeout(() => {
      this.handles.delete(code)
      onExpire()
    }, Math.max(0, deadline - Date.now()))
    this.handles.set(code, { deadline, handle })
  }

  clear(code: string): void {
    const existing = this.handles.get(code)
    if (existing) clearTimeout(existing.handle)
    this.handles.delete(code)
  }
}
```

In `apps/game-server/src/server.ts`:
- Add `role: 'host' | 'player'` to `SocketData`; set `'host'` in `room:create`/`room:watch`, `'player'` in `room:join`.
- Add a broadcast helper and game handlers:

```ts
import { getPack } from '@hpg/content'
import { pickPrompts, wouldYouRather, type AnyGameDefinition, type GameId } from '@hpg/shared'
import { RoomTimers } from './timers'
import type { Room } from './roomManager'

/** Definitions the server can host. Plans 3+ extend this map. */
const definitions: Partial<Record<GameId, AnyGameDefinition>> = {
  'would-you-rather': wouldYouRather,
}

export function attachGameServer(httpServer: HttpServer, rooms = new RoomManager()) {
  const timers = new RoomTimers()
  // ... io setup as before ...

  /** Sends every socket in the room ITS OWN personalized snapshot. */
  async function broadcastRoom(room: Room): Promise<void> {
    const sockets = await io.in(room.code).fetchSockets()
    for (const s of sockets) {
      const msg =
        s.data.role === 'player' && s.data.playerToken
          ? rooms.toPlayerState(room, s.data.playerToken)
          : rooms.toHostState(room)
      if (msg) s.emit('room:state', msg)
    }
  }

  /** Run one action through the reducer, re-arm the timer, broadcast. */
  function dispatch(code: string, action: GameAction): void {
    const room = rooms.applyGameAction(code, action)
    if (!room?.game) return
    timers.reschedule(code, room.game.state.deadline, () =>
      dispatch(code, { type: 'TIMER_EXPIRED', now: Date.now() }),
    )
    void broadcastRoom(room)
  }
```

Inside `io.on('connection')` add:
```ts
    socket.on('game:start', ({ gameId, tone, rounds }, ack) => {
      const code = socket.data.roomCode
      if (!code) return ack({ ok: false, error: 'Not in a room' })
      if (socket.data.role !== 'host') {
        log.warn({ event: 'game_start_rejected', roomCode: code, reason: 'not host' })
        return ack({ ok: false, error: 'Only the host can start a game' })
      }
      const definition = definitions[gameId]
      const pack = getPack(gameId, tone)
      if (!definition || !pack) {
        log.warn({ event: 'game_start_rejected', roomCode: code, reason: 'unknown game/pack', gameId, tone })
        return ack({ ok: false, error: 'Unknown game or pack' })
      }
      const settings = { ...definition.defaultSettings, ...(rounds ? { rounds } : {}) }
      const prompts = pickPrompts(pack, settings.rounds ?? pack.prompts.length)
      const result = rooms.startGame(code, definition, prompts, settings)
      if ('error' in result) {
        log.warn({ event: 'game_start_rejected', roomCode: code, reason: result.error })
        return ack({ ok: false, error: result.error })
      }
      log.info({ event: 'game_started', roomCode: code, gameId, tone })
      ack({ ok: true })
      const game = result.room.game
      if (game) {
        timers.reschedule(code, game.state.deadline, () =>
          dispatch(code, { type: 'TIMER_EXPIRED', now: Date.now() }),
        )
      }
      void broadcastRoom(result.room)
    })

    socket.on('game:input', ({ input }, ack) => {
      const { roomCode, playerToken } = socket.data
      const player = roomCode && playerToken ? rooms.playerByToken(roomCode, playerToken) : undefined
      if (!roomCode || !player) return ack({ ok: false, error: 'Not seated in a game' })
      ack({ ok: true }) // reducer decides validity; invalid input is simply a no-op
      dispatch(roomCode, { type: 'PLAYER_INPUT', playerId: player.id, input, now: Date.now() })
    })

    socket.on('game:advance', () => {
      const code = socket.data.roomCode
      if (code && socket.data.role === 'host') {
        log.info({ event: 'game_phase_advanced', roomCode: code })
        dispatch(code, { type: 'HOST_ADVANCE', now: Date.now() })
      }
    })

    socket.on('game:end', () => {
      const code = socket.data.roomCode
      if (!code || socket.data.role !== 'host') return
      timers.clear(code)
      const room = rooms.endGame(code)
      if (!room) return
      log.info({ event: 'game_ended', roomCode: code })
      void broadcastRoom(room)
    })
```

Also: `room:join` and `disconnect` handlers now broadcast via `broadcastRoom(room)` instead of `io.to(...).emit(...)` (so mid-game joins/drops get personalized views), and the expiry sweep in `index.ts` calls `timers.clear(code)` for each expired room (export `timers` from `attachGameServer`'s return).

- [x] **Step 3: Run to verify PASS, lint, commit**

```bash
pnpm --filter @hpg/game-server test && pnpm lint
git add apps/game-server/src && git commit -m "feat: game events, personalized broadcast, and server-side timers"
```

---

### Task 8: Web — shared components + WYR screens

**Files:**
- Create: `apps/web/src/components/Countdown.tsx`, `apps/web/src/components/Leaderboard.tsx`
- Create: `apps/web/src/components/host/WyrHost.tsx`, `apps/web/src/components/play/WyrPlay.tsx`
- Modify: `apps/web/src/app/host/page.tsx`, `apps/web/src/app/join/page.tsx`

- [x] **Step 1: Shared components**

`apps/web/src/components/Countdown.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'

/** Seconds-remaining pill driven by a server deadline (epoch ms). Renders nothing when no deadline. */
export function Countdown({ deadline }: { deadline: number | null }) {
  const [left, setLeft] = useState(0)
  useEffect(() => {
    if (deadline === null) return
    const tick = () => setLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    tick()
    const id = setInterval(tick, 250)
    return () => clearInterval(id)
  }, [deadline])
  if (deadline === null) return null
  return <span className="rounded-full bg-slate-800 px-3 py-1 font-mono text-lg">{left}s</span>
}
```

`apps/web/src/components/Leaderboard.tsx`:
```tsx
/** Final-score list shared by every game's finished screen. */
export function Leaderboard({
  rows,
  unit,
}: {
  rows: Array<{ playerId: string; nickname: string; score: number }>
  unit: string
}) {
  return (
    <ol className="mx-auto w-full max-w-md space-y-2">
      {rows.map((r, i) => (
        <li key={r.playerId} className="flex justify-between rounded-lg bg-slate-800 px-4 py-3 text-lg">
          <span>
            {i === 0 ? '👑 ' : `${i + 1}. `}
            {r.nickname}
          </span>
          <span className="text-slate-400">
            {r.score} {unit}
          </span>
        </li>
      ))}
    </ol>
  )
}
```

- [x] **Step 2: Host + player WYR components**

`apps/web/src/components/host/WyrHost.tsx`:
```tsx
'use client'
import type { WyrHostView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'

/** TV rendering of Would You Rather. Pure renderer: state in, pixels out. */
export function WyrHost({ view, onAdvance, onEnd }: { view: WyrHostView; onAdvance: () => void; onEnd: () => void }) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-4xl font-bold">Most in the majority</h2>
        <Leaderboard rows={view.leaderboard} unit="rounds" />
        <button onClick={onEnd} className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold">
          Back to lobby
        </button>
      </div>
    )
  }
  return (
    <div className="space-y-8 text-center">
      <p className="text-slate-400">
        Round {view.round}/{view.totalRounds} <Countdown deadline={'deadline' in view ? view.deadline : null} />
      </p>
      <h2 className="text-4xl font-bold">Would you rather…</h2>
      <div className="mx-auto grid max-w-3xl grid-cols-2 gap-6 text-2xl">
        <div className="rounded-2xl bg-indigo-700 p-8">
          {view.prompt.a}
          {view.phase === 'reveal' && <p className="mt-4 text-5xl font-bold">{view.counts.a}</p>}
        </div>
        <div className="rounded-2xl bg-rose-700 p-8">
          {view.prompt.b}
          {view.phase === 'reveal' && <p className="mt-4 text-5xl font-bold">{view.counts.b}</p>}
        </div>
      </div>
      {view.phase === 'vote' && (
        <p className="text-xl text-slate-400">
          {view.votedCount}/{view.totalPlayers} voted
        </p>
      )}
      {view.phase === 'reveal' && (
        <button onClick={onAdvance} className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold">
          Next
        </button>
      )}
    </div>
  )
}
```

`apps/web/src/components/play/WyrPlay.tsx`:
```tsx
'use client'
import type { WyrChoice, WyrPlayerView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'

/** Phone rendering of Would You Rather. */
export function WyrPlay({ view, onVote }: { view: WyrPlayerView; onVote: (choice: WyrChoice) => void }) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-2xl font-bold">Final results</h2>
        <Leaderboard rows={view.leaderboard} unit="rounds" />
      </div>
    )
  }
  const picked = view.yourChoice
  return (
    <div className="space-y-6 text-center">
      <p className="text-slate-400">
        Round {view.round}/{view.totalRounds}{' '}
        {view.phase === 'vote' && <Countdown deadline={view.deadline} />}
      </p>
      <h2 className="text-xl font-bold">Would you rather…</h2>
      {(['a', 'b'] as const).map((c) => (
        <button
          key={c}
          disabled={view.phase !== 'vote'}
          onClick={() => onVote(c)}
          className={`block w-full rounded-2xl p-6 text-lg ${
            c === 'a' ? 'bg-indigo-700' : 'bg-rose-700'
          } ${picked === c ? 'ring-4 ring-white' : picked ? 'opacity-50' : ''}`}
        >
          {view.prompt[c]}
          {view.phase === 'reveal' && <span className="ml-2 font-bold">({view.counts[c]})</span>}
        </button>
      ))}
      {view.phase === 'vote' && picked && <p className="text-slate-400">Vote locked — tap to change</p>}
      {view.phase === 'reveal' && (
        <p className="text-slate-400">{view.majority === 'tie' ? 'Dead tie!' : 'Majority wins a point'}</p>
      )}
    </div>
  )
}
```

- [x] **Step 3: Wire pages**

`apps/web/src/app/host/page.tsx` — replace with:
```tsx
'use client'
import { useEffect, useState } from 'react'
import type { PackTone, RoomStateMsg, WyrHostView } from '@hpg/shared'
import { getSocket } from '@/lib/socket'
import { WyrHost } from '@/components/host/WyrHost'

const TONES: PackTone[] = ['family', 'friends', 'spicy']

export default function HostPage() {
  const [msg, setMsg] = useState<RoomStateMsg | null>(null)
  const [tone, setTone] = useState<PackTone>('friends')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const socket = getSocket()
    socket.emit('room:create', ({ code }) => setMsg({ code, phase: 'lobby', players: [] }))
    socket.on('room:state', setMsg)
    return () => {
      socket.off('room:state', setMsg)
    }
  }, [])

  function startGame() {
    // Spicy packs are adult-only: the host confirms once, for the room (spec: 18+ gate).
    if (tone === 'spicy' && !window.confirm('Spicy pack is 18+. Everyone in the room is an adult?')) return
    setError(null)
    getSocket().emit('game:start', { gameId: 'would-you-rather', tone }, (res) => {
      if (!res.ok) setError(res.error)
    })
  }

  if (!msg) return <main className="grid min-h-screen place-items-center">Creating room…</main>

  if (msg.phase === 'game' && msg.game) {
    return (
      <main className="grid min-h-screen place-items-center bg-slate-950 p-8 text-white">
        <WyrHost
          view={msg.game.view as WyrHostView}
          onAdvance={() => getSocket().emit('game:advance')}
          onEnd={() => getSocket().emit('game:end')}
        />
      </main>
    )
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
      <div className="space-y-6 text-center">
        <p className="text-xl text-slate-400">Join at {window.location.host}/join with code</p>
        <p className="font-mono text-8xl font-bold tracking-[0.3em]" data-testid="room-code">
          {msg.code}
        </p>
        <ul className="flex flex-wrap justify-center gap-3">
          {msg.players.map((p) => (
            <li
              key={p.id}
              className={`rounded-full px-4 py-2 text-lg ${p.connected ? 'bg-emerald-600' : 'bg-slate-700 line-through'}`}
            >
              {p.nickname}
            </li>
          ))}
        </ul>
        {msg.players.length === 0 ? (
          <p className="text-slate-500">Waiting for players…</p>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-center gap-2">
              {TONES.map((t) => (
                <button
                  key={t}
                  onClick={() => setTone(t)}
                  className={`rounded-full px-4 py-2 capitalize ${tone === t ? 'bg-indigo-600' : 'bg-slate-800'}`}
                >
                  {t}
                  {t === 'spicy' && ' 🔞'}
                </button>
              ))}
            </div>
            <button onClick={startGame} className="rounded-lg bg-emerald-600 px-8 py-4 text-xl font-bold">
              Start Would You Rather
            </button>
            {error && <p className="text-red-400">{error}</p>}
          </div>
        )}
      </div>
    </main>
  )
}
```

`apps/web/src/app/join/page.tsx` — in the joined branch, replace the waiting view with:
```tsx
  if (view) {
    if (view.phase === 'game' && view.game) {
      return (
        <main className="min-h-screen bg-slate-950 p-6 text-white">
          <WyrPlay
            view={view.game.view as WyrPlayerView}
            onVote={(choice) => getSocket().emit('game:input', { input: { choice } }, () => {})}
          />
        </main>
      )
    }
    // ...existing lobby list unchanged...
  }
```
(with imports `WyrPlay`, `WyrPlayerView`; the state type becomes `RoomStateMsg`.)

- [x] **Step 4: Build, lint, commit**

```bash
pnpm --filter @hpg/web build && pnpm lint
git add apps/web/src && git commit -m "feat: would-you-rather host and player screens"
```

---

### Task 9: Playwright e2e

**Files:**
- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/would-you-rather.spec.ts`

- [x] **Step 1: Install and configure**

```bash
pnpm --filter @hpg/web add -D @playwright/test
pnpm --filter @hpg/web exec playwright install chromium
```

`apps/web/playwright.config.ts`:
```ts
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:3000' },
  webServer: [
    { command: 'pnpm --filter @hpg/game-server dev', port: 4000, reuseExistingServer: true, cwd: '../..' },
    { command: 'pnpm --filter @hpg/web dev', port: 3000, reuseExistingServer: true, cwd: '../..' },
  ],
})
```

Add to `apps/web/package.json` scripts: `"e2e": "playwright test"`.

- [x] **Step 2: Write the happy-path test**

`apps/web/e2e/would-you-rather.spec.ts`:
```ts
import { expect, test } from '@playwright/test'

test('host + two players play a full WYR round', async ({ browser }) => {
  const host = await (await browser.newContext()).newPage()
  await host.goto('/host')
  const code = await host.getByTestId('room-code').innerText()

  const players = []
  for (const name of ['Ana', 'Ben']) {
    const page = await (await browser.newContext()).newPage()
    await page.goto('/join')
    await page.getByPlaceholder('ROOM CODE').fill(code)
    await page.getByPlaceholder('Your nickname').fill(name)
    await page.getByRole('button', { name: 'Join' }).click()
    players.push(page)
  }
  await expect(host.getByText('Ana')).toBeVisible()
  await expect(host.getByText('Ben')).toBeVisible()

  await host.getByRole('button', { name: 'Start Would You Rather' }).click()
  await expect(host.getByText('Would you rather…')).toBeVisible()

  for (const page of players) {
    await expect(page.getByText('Would you rather…')).toBeVisible()
    await page.locator('button:not([disabled])').first().click()
  }
  // Both voted → reveal shows on the TV with a Next button.
  await expect(host.getByRole('button', { name: 'Next' })).toBeVisible()
})
```

- [x] **Step 3: Run, commit**

```bash
pnpm --filter @hpg/web e2e   # expect: 1 passed
git add apps/web && git commit -m "test: playwright e2e for would-you-rather happy path"
```

---

### Task 10: Manual verification + milestone

- [x] **Step 1:** `pnpm test && pnpm lint && pnpm --filter @hpg/web e2e` — all green.
- [x] **Step 2:** Start both apps; play a full 3-round game with two phone-sized windows + one host window: votes lock in, timer forces reveal if someone stalls, reveal counts are right, changing a vote before the last voter works, final leaderboard shows, "Back to lobby" returns everyone, and a phone reload mid-round restores the current round view (reconnect).
- [x] **Step 3:** Kill and restart the game-server mid-game — clients show disconnected state, and creating a fresh room works (rooms are ephemeral by design).
- [x] **Step 4:** Tag: `git tag plan-2-would-you-rather`

---

## Self-review notes

- **Spec coverage (plan-2 slice):** GameDefinition pure functions ✓, server-authoritative timers dispatching TIMER_EXPIRED ✓, personalized per-socket views (info-hiding foundation) ✓, content packs family/friends/spicy with 18+ gate ✓, host advance control ✓, reconnect returns current view (via existing token + broadcastRoom) ✓, Playwright e2e ✓, JSON log events for every game transition ✓.
- **Deviation from spec, intentional:** packs are typed TS modules (JSON-shaped, build-time validated) instead of raw `.json` files — better type safety, zero loader config. Custom packs (plan 4) still transport as JSON.
- **Types:** `WyrHostView`/`WyrPlayerView`/`RoomStateMsg`/`StartGameResult` defined once and imported everywhere; `toHostState`/`toPlayerState`/`playerByToken`/`applyGameAction` names consistent between Task 6 tests and implementation and Task 7 wiring.

---

## Deviations (recorded during execution)

Executor: subagent-driven-development / direct-implementation session on 2026-07-13, continuing from plan 1's environment (see plan 1's `## Deviations` for pnpm-via-corepack, `.prettierignore` scope, and Next 16 / Tailwind v4 notes).

- **`broadcastRoom` is synchronous.** The plan's snippet uses `await io.in(room.code).fetchSockets()` and returns a Promise. In this repo it walks `io.sockets.adapter.rooms.get(code)` synchronously instead, so every personalized emit is queued in the same event-loop tick as the caller's ack. This restores the plan-1 intra-tick ordering guarantee (broadcast frames queued before ack response) without any async hop, so a client that registers a `room:state` listener right after `emitWithAck` resolves does not miss the state change. Same target/payload; only the async boundary is gone.
- **`server.test.ts` `nextState` helper gained a predicate.** The plan's helper listens for `c.once('room:state', resolve)`. That's inherently racy across sockets — the game-flow test registers listeners on host/p2 *after* awaiting p1's `emitWithAck`, at which point p1's vote broadcast is racing to reach the other sockets. To make the plan's verbatim assertions deterministic, `nextState` now accepts an optional predicate and a `nextGamePhase(client, phase)` sugar. Only the helper changed; the tests still assert what the plan intended.
- **`toView` kept as a compat alias.** Task 6 was expected to replace `toView`, but socket code called it before Task 7's rewiring. Task 6 renames it to a thin alias over `toHostState`, and Task 7 deletes the last call sites — no behavior change, but the alias existed on-branch between the two commits so the tree kept compiling.
- **`@hpg/content` added as a `@hpg/game-server` dependency.** The plan's Task 7 snippet imports `@hpg/content` without touching game-server's `package.json`; the workspace resolver needs it explicit. Added `@hpg/content: workspace:*` to game-server dependencies.
- **`.gitignore` broadened during Task 9.** The Playwright run drops `apps/web/test-results/` (per-run report) and I initially staged it by mistake. `.gitignore` now excludes it, `apps/web/playwright-report/`, and `.DS_Store` (previously untracked but still noisy). The stray commit was reverted in the same session.
- **Playwright `Next` button selector uses `exact: true`.** Next 16's dev-tools overlay ships an `Open Next.js Dev Tools` button that partially matches "Next", so the plan's `getByRole('button', { name: 'Next' })` was ambiguous. `exact: true` disambiguates it. The runtime UI text is unchanged.

Ordering / semantics preserved everywhere: personalized snapshots, event names (`game_started`, `game_input_rejected`, `game_phase_advanced`, `game_ended`), error strings (`Need at least 2 players`, `Only the host can start a game`, `Unknown game or pack`, `Not seated in a game`), and the `game:*` wire shapes match the plan and the spec.
