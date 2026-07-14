# Plan 3: Most Likely To, Never Have I Ever, Who Said That Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three more games on the plan-2 engine: player-targeted voting (Most Likely To), yes/no confessions with configurable reveal (Never Have I Ever), and a submission-then-guess loop (Who Said That).

**Architecture:** No engine or server-architecture changes. Each game = one `GameDefinition` module in `packages/shared/src/games/` + starter packs in `@hpg/content` + one host component + one play component + a registry entry. The host page gains a game picker; rendering dispatches on `game.id`.

**Standards (apply to every task):** JSDoc on exports; comments explain *why*; pino JSON logs already cover game events generically (`game_started` carries `gameId`); `pnpm lint` before every commit. TDD for every reducer.

**Pre-flight:** plan 2 complete (`plan-2-would-you-rather` tag), `pnpm test`, `pnpm lint`, `pnpm --filter @hpg/web e2e` green. Follow the Pre-flight rule in `docs/superpowers/plans/README.md`. **The engine API used here is exactly plan 2's — if signatures drifted, reconcile before starting.**

---

## File structure

```
packages/shared/src/games/
├── mostLikelyTo.ts + .test.ts
├── neverHaveIEver.ts + .test.ts
└── whoSaidThat.ts + .test.ts
packages/content/src/
├── mostLikelyTo.ts / neverHaveIEver.ts / whoSaidThat.ts   # 3 tones × 10 starter prompts each
└── index.ts                     # MODIFIED: register new packs
apps/web/src/components/
├── host/GameHost.tsx            # dispatch on game id → per-game host component
├── play/GamePlay.tsx            # dispatch on game id → per-game play component
├── host/MltHost.tsx / NhieHost.tsx / WstHost.tsx
└── play/MltPlay.tsx / NhiePlay.tsx / WstPlay.tsx
apps/web/src/app/host/page.tsx   # MODIFIED: game picker (4 games) + GameHost
apps/web/src/app/join/page.tsx   # MODIFIED: GamePlay
apps/game-server/src/server.ts   # MODIFIED: register 3 definitions
```

---

### Task 1: Game dispatch components + host game picker

**Files:**
- Create: `apps/web/src/components/host/GameHost.tsx`, `apps/web/src/components/play/GamePlay.tsx`
- Modify: `apps/web/src/app/host/page.tsx`, `apps/web/src/app/join/page.tsx`

- [x] **Step 1: Dispatch components** (WYR only for now; later tasks extend the switch)

`apps/web/src/components/host/GameHost.tsx`:
```tsx
'use client'
import type { GameId, WyrHostView } from '@hpg/shared'
import { WyrHost } from './WyrHost'

export interface GameHostProps {
  gameId: GameId
  view: unknown
  onAdvance: () => void
  onEnd: () => void
}

/** Routes the personalized host view to the right game's TV renderer. */
export function GameHost({ gameId, view, onAdvance, onEnd }: GameHostProps) {
  switch (gameId) {
    case 'would-you-rather':
      return <WyrHost view={view as WyrHostView} onAdvance={onAdvance} onEnd={onEnd} />
    default:
      return <p>Unknown game: {gameId}</p>
  }
}
```

`apps/web/src/components/play/GamePlay.tsx`:
```tsx
'use client'
import type { GameId, WyrPlayerView } from '@hpg/shared'
import { getSocket } from '@/lib/socket'
import { WyrPlay } from './WyrPlay'

/** Routes the personalized player view to the right game's phone renderer. */
export function GamePlay({ gameId, view }: { gameId: GameId; view: unknown }) {
  const input = (input: unknown) => getSocket().emit('game:input', { input }, () => {})
  switch (gameId) {
    case 'would-you-rather':
      return <WyrPlay view={view as WyrPlayerView} onVote={(choice) => input({ choice })} />
    default:
      return <p>Unknown game: {gameId}</p>
  }
}
```

- [x] **Step 2: Host page game picker**

In `apps/web/src/app/host/page.tsx`: replace the in-game branch with `<GameHost gameId={msg.game.id} view={msg.game.view} …/>`, replace the single start button with a picker over a local list (only entries whose definitions exist are enabled):

```tsx
const GAMES: Array<{ id: GameId; name: string }> = [
  { id: 'would-you-rather', name: 'Would You Rather' },
  { id: 'most-likely-to', name: 'Most Likely To' },
  { id: 'never-have-i-ever', name: 'Never Have I Ever' },
  { id: 'who-said-that', name: 'Who Said That?' },
]
```
with `const [gameId, setGameId] = useState<GameId>('would-you-rather')`, a button row styled like the tone picker, and `startGame()` emitting `{ gameId, tone }`. In `join/page.tsx`, replace the WYR branch with `<GamePlay gameId={view.game.id} view={view.game.view} />`.

- [x] **Step 3: Verify, commit**

```bash
pnpm --filter @hpg/web build && pnpm --filter @hpg/web e2e && pnpm lint
git add apps/web/src && git commit -m "refactor: game dispatch components and host game picker"
```

---

### Task 2: Most Likely To definition (TDD)

**Files:**
- Create: `packages/shared/src/games/mostLikelyTo.ts`
- Test: `packages/shared/src/games/mostLikelyTo.test.ts`
- Modify: `packages/shared/src/index.ts` (`export * from './games/mostLikelyTo'`)

- [x] **Step 1: Failing tests**

`packages/shared/src/games/mostLikelyTo.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { GamePlayer } from '../engine/types'
import type { MltState } from './mostLikelyTo'
import { mostLikelyTo } from './mostLikelyTo'

const players: GamePlayer[] = [
  { id: 'p1', nickname: 'Ana', connected: true },
  { id: 'p2', nickname: 'Ben', connected: true },
  { id: 'p3', nickname: 'Cy', connected: true },
]
const prompts = [{ id: 'q1', text: 'become famous accidentally' }]
const settings = { rounds: 1, voteSeconds: 30, revealSeconds: 8, anonymousVotes: true }
const T0 = 1_000_000

function fresh(): MltState {
  return mostLikelyTo.init({ players, prompts, settings, now: T0 })
}
function vote(s: MltState, playerId: string, targetId: string): MltState {
  return mostLikelyTo.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { targetId }, now: T0 })
}

describe('most-likely-to', () => {
  it('collects votes for players; self-votes and unknown targets are ignored', () => {
    let s = vote(fresh(), 'p1', 'p1') // self-vote ignored
    expect(s.votes[0]).toEqual({})
    s = vote(s, 'p1', 'ghost') // unknown target ignored
    expect(s.votes[0]).toEqual({})
    s = vote(s, 'p1', 'p2')
    expect(s.votes[0]).toEqual({ p1: 'p2' })
  })

  it('reveals when all connected players voted and scores votes received', () => {
    let s = vote(fresh(), 'p1', 'p3')
    s = vote(s, 'p2', 'p3')
    s = vote(s, 'p3', 'p1')
    expect(s.phase).toBe('reveal')
    expect(s.scores).toEqual({ p1: 1, p2: 0, p3: 2 })
  })

  it('hides voter identities in views when anonymousVotes is true', () => {
    let s = fresh()
    for (const [voter, target] of [['p1', 'p3'], ['p2', 'p3'], ['p3', 'p1']] as const) s = vote(s, voter, target)
    const view = mostLikelyTo.playerView(s, 'p1') as { phase: string; tally: Array<{ voters?: string[] }> }
    expect(view.phase).toBe('reveal')
    for (const row of view.tally) expect(row.voters).toBeUndefined()
  })

  it('shows voter names when anonymousVotes is false', () => {
    let s = mostLikelyTo.init({ players, prompts, settings: { ...settings, anonymousVotes: false }, now: T0 })
    for (const [voter, target] of [['p1', 'p3'], ['p2', 'p3'], ['p3', 'p1']] as const) s = vote(s, voter, target)
    const view = mostLikelyTo.playerView(s, 'p1') as { tally: Array<{ playerId: string; voters?: string[] }> }
    expect(view.tally.find((t) => t.playerId === 'p3')?.voters).toEqual(['Ana', 'Ben'])
  })

  it('finishes after the last reveal', () => {
    let s = fresh()
    for (const [voter, target] of [['p1', 'p3'], ['p2', 'p3'], ['p3', 'p1']] as const) s = vote(s, voter, target)
    s = mostLikelyTo.reducer(s, { type: 'HOST_ADVANCE', now: T0 + 10_000 })
    expect(mostLikelyTo.isFinished(s)).toBe(true)
  })
})
```

- [x] **Step 2: Run FAIL, then implement**

`packages/shared/src/games/mostLikelyTo.ts`:
```ts
import type { GameDefinition, GamePlayer, TimedState } from '../engine/types'

export interface MltPrompt {
  id: string
  text: string
}

export interface MltSettings {
  rounds: number
  voteSeconds: number
  revealSeconds: number
  /** true (default): the reveal shows counts only, never who voted for whom. */
  anonymousVotes: boolean
}

export interface MltState extends TimedState {
  phase: 'vote' | 'reveal' | 'finished'
  round: number
  prompts: MltPrompt[]
  players: GamePlayer[]
  /** votes[roundIndex][voterId] = targetId */
  votes: Array<Record<string, string>>
  /** playerId -> total votes received across rounds */
  scores: Record<string, number>
  settings: MltSettings
}

export interface MltTallyRow {
  playerId: string
  nickname: string
  count: number
  /** present only when anonymousVotes is false */
  voters?: string[]
}

export type MltPlayerView =
  | {
      phase: 'vote'
      round: number
      totalRounds: number
      prompt: MltPrompt
      candidates: Array<{ id: string; nickname: string }>
      yourVote: string | null
      deadline: number | null
    }
  | { phase: 'reveal'; round: number; totalRounds: number; prompt: MltPrompt; tally: MltTallyRow[] }
  | { phase: 'finished'; leaderboard: Array<{ playerId: string; nickname: string; score: number }> }

export type MltHostView =
  | {
      phase: 'vote'
      round: number
      totalRounds: number
      prompt: MltPrompt
      votedCount: number
      totalPlayers: number
      deadline: number | null
    }
  | { phase: 'reveal'; round: number; totalRounds: number; prompt: MltPrompt; tally: MltTallyRow[] }
  | { phase: 'finished'; leaderboard: Array<{ playerId: string; nickname: string; score: number }> }

function active(state: MltState): GamePlayer[] {
  return state.players.filter((p) => p.connected)
}
function currentVotes(state: MltState): Record<string, string> {
  return state.votes[state.round - 1] ?? {}
}

function tally(state: MltState): MltTallyRow[] {
  const votes = currentVotes(state)
  return state.players
    .map((p) => {
      const voters = Object.entries(votes)
        .filter(([, target]) => target === p.id)
        .map(([voterId]) => state.players.find((x) => x.id === voterId)?.nickname ?? '?')
      const row: MltTallyRow = { playerId: p.id, nickname: p.nickname, count: voters.length }
      if (!state.settings.anonymousVotes) row.voters = voters
      return row
    })
    .sort((a, b) => b.count - a.count)
}

function toReveal(state: MltState, now: number): MltState {
  const scores = { ...state.scores }
  for (const target of Object.values(currentVotes(state))) scores[target] = (scores[target] ?? 0) + 1
  return { ...state, phase: 'reveal', scores, deadline: now + state.settings.revealSeconds * 1000 }
}

function advance(state: MltState, now: number): MltState {
  if (state.round >= state.settings.rounds) return { ...state, phase: 'finished', deadline: null }
  return {
    ...state,
    phase: 'vote',
    round: state.round + 1,
    votes: [...state.votes, {}],
    deadline: now + state.settings.voteSeconds * 1000,
  }
}

function leaderboard(state: MltState) {
  return state.players
    .map((p) => ({ playerId: p.id, nickname: p.nickname, score: state.scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score)
}

/** Most Likely To: everyone secretly votes for the player who best fits the prompt. */
export const mostLikelyTo: GameDefinition<MltState, MltSettings, MltPrompt> = {
  id: 'most-likely-to',
  minPlayers: 3,
  defaultSettings: { rounds: 10, voteSeconds: 30, revealSeconds: 10, anonymousVotes: true },

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

  reducer(state, action): MltState {
    switch (action.type) {
      case 'PLAYER_INPUT': {
        if (state.phase !== 'vote') return state
        if (!state.players.some((p) => p.id === action.playerId)) return state
        const target = (action.input as { targetId?: unknown })?.targetId
        // Self-votes defeat the game's point; unknown targets are client bugs — both no-ops.
        if (typeof target !== 'string' || target === action.playerId) return state
        if (!state.players.some((p) => p.id === target)) return state

        const votes = [...state.votes]
        votes[state.round - 1] = { ...currentVotes(state), [action.playerId]: target }
        const next = { ...state, votes }
        return active(next).every((p) => votes[state.round - 1][p.id]) ? toReveal(next, action.now) : next
      }
      case 'TIMER_EXPIRED':
      case 'HOST_ADVANCE':
        if (state.phase === 'vote') return toReveal(state, action.now)
        if (state.phase === 'reveal') return advance(state, action.now)
        return state
    }
  },

  playerView(state, playerId): MltPlayerView {
    const prompt = state.prompts[state.round - 1]
    if (state.phase === 'vote') {
      return {
        phase: 'vote',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        candidates: state.players.filter((p) => p.id !== playerId).map(({ id, nickname }) => ({ id, nickname })),
        yourVote: currentVotes(state)[playerId] ?? null,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return { phase: 'reveal', round: state.round, totalRounds: state.settings.rounds, prompt, tally: tally(state) }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  hostView(state): MltHostView {
    const prompt = state.prompts[state.round - 1]
    if (state.phase === 'vote') {
      return {
        phase: 'vote',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        votedCount: Object.keys(currentVotes(state)).length,
        totalPlayers: active(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return { phase: 'reveal', round: state.round, totalRounds: state.settings.rounds, prompt, tally: tally(state) }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  isFinished: (state) => state.phase === 'finished',
}
```

- [x] **Step 3: PASS, lint, commit** — `git commit -m "feat: most-likely-to game definition"`

---

### Task 3: Most Likely To content + UI + registration

**Files:**
- Create: `packages/content/src/mostLikelyTo.ts`
- Create: `apps/web/src/components/host/MltHost.tsx`, `apps/web/src/components/play/MltPlay.tsx`
- Modify: `packages/content/src/index.ts`, `apps/game-server/src/server.ts`, `GameHost.tsx`, `GamePlay.tsx`

- [x] **Step 1: Content packs**

`packages/content/src/mostLikelyTo.ts`:
```ts
import type { ContentPack, MltPrompt } from '@hpg/shared'

const p = (id: string, text: string): MltPrompt => ({ id, text })

export const mltFamily: ContentPack<MltPrompt> = {
  id: 'mlt-family-v1',
  game: 'most-likely-to',
  tone: 'family',
  locale: 'en',
  prompts: [
    p('mlt-fam-1', 'become a famous inventor'),
    p('mlt-fam-2', 'forget their own birthday'),
    p('mlt-fam-3', 'laugh at the worst possible moment'),
    p('mlt-fam-4', 'win a gold medal someday'),
    p('mlt-fam-5', 'eat dessert before dinner'),
    p('mlt-fam-6', 'get lost inside a mall'),
    p('mlt-fam-7', 'adopt ten pets'),
    p('mlt-fam-8', 'sleep through three alarms'),
    p('mlt-fam-9', 'become a teacher'),
    p('mlt-fam-10', 'talk to animals like they understand'),
  ],
}

export const mltFriends: ContentPack<MltPrompt> = {
  id: 'mlt-friends-v1',
  game: 'most-likely-to',
  tone: 'friends',
  locale: 'en',
  prompts: [
    p('mlt-fri-1', 'become famous accidentally'),
    p('mlt-fri-2', 'reply "lol" to terrible news'),
    p('mlt-fri-3', 'ghost the group chat for a week'),
    p('mlt-fri-4', 'cry at a commercial'),
    p('mlt-fri-5', 'spend rent money on concert tickets'),
    p('mlt-fri-6', 'forget where they parked'),
    p('mlt-fri-7', 'trip over absolutely nothing'),
    p('mlt-fri-8', 'argue with a stranger online'),
    p('mlt-fri-9', 'get a tattoo on a whim'),
    p('mlt-fri-10', 'become a millionaire and lose it all'),
  ],
}

export const mltSpicy: ContentPack<MltPrompt> = {
  id: 'mlt-spicy-v1',
  game: 'most-likely-to',
  tone: 'spicy',
  locale: 'en',
  prompts: [
    p('mlt-spi-1', 'text an ex at 2am'),
    p('mlt-spi-2', 'have a secret dating profile'),
    p('mlt-spi-3', 'kiss a stranger on vacation'),
    p('mlt-spi-4', 'accidentally date two people at once'),
    p('mlt-spi-5', 'flirt their way out of a parking ticket'),
    p('mlt-spi-6', 'marry someone they met a month ago'),
    p('mlt-spi-7', 'have a crush on someone in this room'),
    p('mlt-spi-8', 'slide into a celebrity's DMs'),
    p('mlt-spi-9', 'get caught checking out their ex's profile'),
    p('mlt-spi-10', 'leave a bad date through the bathroom window'),
  ],
}
```
(Note: escape the apostrophes as needed — `celebrity\'s` etc. — or use double quotes.)

Register in `packages/content/src/index.ts`:
```ts
import { mltFamily, mltFriends, mltSpicy } from './mostLikelyTo'
export * from './mostLikelyTo'
// in registry:
'most-likely-to': { family: mltFamily, friends: mltFriends, spicy: mltSpicy },
```

- [x] **Step 2: Components**

`apps/web/src/components/host/MltHost.tsx`:
```tsx
'use client'
import type { MltHostView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'

/** TV rendering of Most Likely To. */
export function MltHost({ view, onAdvance, onEnd }: { view: MltHostView; onAdvance: () => void; onEnd: () => void }) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-4xl font-bold">Most voted overall</h2>
        <Leaderboard rows={view.leaderboard} unit="votes" />
        <button onClick={onEnd} className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold">Back to lobby</button>
      </div>
    )
  }
  return (
    <div className="space-y-8 text-center">
      <p className="text-slate-400">
        Round {view.round}/{view.totalRounds} {view.phase === 'vote' && <Countdown deadline={view.deadline} />}
      </p>
      <h2 className="text-4xl font-bold">Who is most likely to {view.prompt.text}?</h2>
      {view.phase === 'vote' && (
        <p className="text-xl text-slate-400">{view.votedCount}/{view.totalPlayers} voted</p>
      )}
      {view.phase === 'reveal' && (
        <>
          <ul className="mx-auto w-full max-w-md space-y-2">
            {view.tally.map((row) => (
              <li key={row.playerId} className="flex justify-between rounded-lg bg-slate-800 px-4 py-3 text-xl">
                <span>{row.nickname}</span>
                <span>
                  {'🔥'.repeat(row.count)} {row.count}
                  {row.voters && row.voters.length > 0 && (
                    <span className="ml-2 text-sm text-slate-400">({row.voters.join(', ')})</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <button onClick={onAdvance} className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold">Next</button>
        </>
      )}
    </div>
  )
}
```

`apps/web/src/components/play/MltPlay.tsx`:
```tsx
'use client'
import type { MltPlayerView } from '@hpg/shared'
import { Countdown } from '../Countdown'
import { Leaderboard } from '../Leaderboard'

/** Phone rendering of Most Likely To: tap a friend. */
export function MltPlay({ view, onVote }: { view: MltPlayerView; onVote: (targetId: string) => void }) {
  if (view.phase === 'finished') {
    return (
      <div className="space-y-6 text-center">
        <h2 className="text-2xl font-bold">Final tally</h2>
        <Leaderboard rows={view.leaderboard} unit="votes" />
      </div>
    )
  }
  if (view.phase === 'reveal') {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-xl font-bold">Most likely to {view.prompt.text}</h2>
        <ul className="space-y-2">
          {view.tally.map((row) => (
            <li key={row.playerId} className="flex justify-between rounded-lg bg-slate-800 px-4 py-3">
              <span>{row.nickname}</span>
              <span>{row.count}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  return (
    <div className="space-y-4 text-center">
      <p className="text-slate-400">
        Round {view.round}/{view.totalRounds} <Countdown deadline={view.deadline} />
      </p>
      <h2 className="text-xl font-bold">Who is most likely to {view.prompt.text}?</h2>
      {view.candidates.map((c) => (
        <button
          key={c.id}
          onClick={() => onVote(c.id)}
          className={`block w-full rounded-2xl bg-slate-800 p-4 text-lg ${
            view.yourVote === c.id ? 'ring-4 ring-white' : view.yourVote ? 'opacity-50' : ''
          }`}
        >
          {c.nickname}
        </button>
      ))}
    </div>
  )
}
```

- [x] **Step 3: Register everywhere**

- `apps/game-server/src/server.ts` definitions map: `'most-likely-to': mostLikelyTo,` (import from `@hpg/shared`).
- `GameHost.tsx` switch: `case 'most-likely-to': return <MltHost view={view as MltHostView} onAdvance={onAdvance} onEnd={onEnd} />`
- `GamePlay.tsx` switch: `case 'most-likely-to': return <MltPlay view={view as MltPlayerView} onVote={(targetId) => input({ targetId })} />`

- [x] **Step 4: Verify, commit**

```bash
pnpm test && pnpm --filter @hpg/web build && pnpm lint
git add -A && git commit -m "feat: most-likely-to content, screens, and registration"
```

---

### Task 4: Never Have I Ever definition (TDD)

**Files:**
- Create: `packages/shared/src/games/neverHaveIEver.ts`
- Test: `packages/shared/src/games/neverHaveIEver.test.ts`
- Modify: `packages/shared/src/index.ts`

- [x] **Step 1: Failing tests**

`packages/shared/src/games/neverHaveIEver.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { GamePlayer } from '../engine/types'
import type { NhieState } from './neverHaveIEver'
import { neverHaveIEver } from './neverHaveIEver'

const players: GamePlayer[] = [
  { id: 'p1', nickname: 'Ana', connected: true },
  { id: 'p2', nickname: 'Ben', connected: true },
  { id: 'p3', nickname: 'Cy', connected: true },
]
const prompts = [
  { id: 'q1', text: 'missed a flight' },
  { id: 'q2', text: 'sung karaoke' },
  { id: 'q3', text: 'broken a bone' },
]
const base = {
  rounds: 3,
  answerSeconds: 20,
  revealSeconds: 8,
  revealMode: 'names' as const,
  elimination: false,
  strikes: 2,
}
const T0 = 1_000_000

function fresh(settings = base): NhieState {
  return neverHaveIEver.init({ players, prompts, settings, now: T0 })
}
function answer(s: NhieState, playerId: string, done: boolean): NhieState {
  return neverHaveIEver.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { done }, now: T0 })
}
function allAnswer(s: NhieState, map: Record<string, boolean>): NhieState {
  for (const [id, done] of Object.entries(map)) s = answer(s, id, done)
  return s
}

describe('never-have-i-ever', () => {
  it('reveals once everyone answered, tracking strikes for "I have"', () => {
    const s = allAnswer(fresh(), { p1: true, p2: false, p3: true })
    expect(s.phase).toBe('reveal')
    expect(s.strikes).toEqual({ p1: 1, p2: 0, p3: 1 })
  })

  it('names mode exposes who said yes; count mode only exposes the number', () => {
    const named = allAnswer(fresh(), { p1: true, p2: false, p3: false })
    const nView = neverHaveIEver.playerView(named, 'p2') as { yesNames?: string[]; yesCount: number }
    expect(nView.yesNames).toEqual(['Ana'])

    const counted = allAnswer(fresh({ ...base, revealMode: 'count' }), { p1: true, p2: false, p3: false })
    const cView = neverHaveIEver.playerView(counted, 'p2') as { yesNames?: string[]; yesCount: number }
    expect(cView.yesCount).toBe(1)
    expect(cView.yesNames).toBeUndefined()
  })

  it('elimination mode ends early when one player remains', () => {
    let s = fresh({ ...base, elimination: true, strikes: 1 })
    s = allAnswer(s, { p1: true, p2: true, p3: false }) // p1+p2 eliminated at 1 strike
    s = neverHaveIEver.reducer(s, { type: 'HOST_ADVANCE', now: T0 + 5000 })
    expect(s.phase).toBe('finished')
  })

  it('eliminated players cannot answer and are not waited on', () => {
    let s = fresh({ ...base, elimination: true, strikes: 1, rounds: 3 })
    s = allAnswer(s, { p1: true, p2: false, p3: false }) // p1 out
    s = neverHaveIEver.reducer(s, { type: 'HOST_ADVANCE', now: T0 + 5000 })
    expect(s.phase).toBe('answer')
    s = allAnswer(s, { p2: false, p3: false }) // only p2+p3 needed
    expect(s.phase).toBe('reveal')
    expect(answer(s, 'p1', false)).toEqual(s) // eliminated input ignored
  })

  it('finishes after all rounds with strikes as the leaderboard (fewest first)', () => {
    let s = fresh({ ...base, rounds: 1 })
    s = allAnswer(s, { p1: true, p2: false, p3: true })
    s = neverHaveIEver.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 9000 })
    expect(s.phase).toBe('finished')
    const view = neverHaveIEver.hostView(s) as { leaderboard: Array<{ playerId: string }> }
    expect(view.leaderboard[0].playerId).toBe('p2') // most innocent first
  })
})
```

- [x] **Step 2: Run FAIL, then implement**

`packages/shared/src/games/neverHaveIEver.ts`:
```ts
import type { GameDefinition, GamePlayer, TimedState } from '../engine/types'

export interface NhiePrompt {
  id: string
  text: string
}

export interface NhieSettings {
  rounds: number
  answerSeconds: number
  revealSeconds: number
  /** 'names' shows who said "I have"; 'count' shows only how many (spec: anonymous mode). */
  revealMode: 'names' | 'count'
  /** When true, players are knocked out at `strikes` yeses; last standing wins. */
  elimination: boolean
  strikes: number
}

export interface NhieState extends TimedState {
  phase: 'answer' | 'reveal' | 'finished'
  round: number
  prompts: NhiePrompt[]
  players: GamePlayer[]
  /** answers[roundIndex][playerId] = true means "I have" */
  answers: Array<Record<string, boolean>>
  /** playerId -> total "I have" count (doubles as strikes in elimination mode) */
  strikes: Record<string, number>
  settings: NhieSettings
}

interface LeaderboardRow {
  playerId: string
  nickname: string
  score: number
}

export type NhiePlayerView =
  | {
      phase: 'answer'
      round: number
      totalRounds: number
      prompt: NhiePrompt
      yourAnswer: boolean | null
      eliminated: boolean
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      prompt: NhiePrompt
      yesCount: number
      yesNames?: string[]
      yourAnswer: boolean | null
      eliminatedNow: string[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[]; elimination: boolean }

export type NhieHostView =
  | {
      phase: 'answer'
      round: number
      totalRounds: number
      prompt: NhiePrompt
      answeredCount: number
      totalPlayers: number
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      prompt: NhiePrompt
      yesCount: number
      yesNames?: string[]
      eliminatedNow: string[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[]; elimination: boolean }

function isEliminated(state: NhieState, playerId: string): boolean {
  return state.settings.elimination && (state.strikes[playerId] ?? 0) >= state.settings.strikes
}

/** Players the round waits on: connected and still in the game. */
function active(state: NhieState): GamePlayer[] {
  return state.players.filter((p) => p.connected && !isEliminated(state, p.id))
}

function current(state: NhieState): Record<string, boolean> {
  return state.answers[state.round - 1] ?? {}
}

function toReveal(state: NhieState, now: number): NhieState {
  const strikes = { ...state.strikes }
  for (const [playerId, done] of Object.entries(current(state))) {
    if (done) strikes[playerId] = (strikes[playerId] ?? 0) + 1
  }
  return { ...state, phase: 'reveal', strikes, deadline: now + state.settings.revealSeconds * 1000 }
}

function advance(state: NhieState, now: number): NhieState {
  const finished =
    state.round >= state.settings.rounds || (state.settings.elimination && active(state).length <= 1)
  if (finished) return { ...state, phase: 'finished', deadline: null }
  return {
    ...state,
    phase: 'answer',
    round: state.round + 1,
    answers: [...state.answers, {}],
    deadline: now + state.settings.answerSeconds * 1000,
  }
}

/** Fewest "I have" answers first — the most innocent player tops the board. */
function leaderboard(state: NhieState): LeaderboardRow[] {
  return state.players
    .map((p) => ({ playerId: p.id, nickname: p.nickname, score: state.strikes[p.id] ?? 0 }))
    .sort((a, b) => a.score - b.score)
}

/** Nicknames of players eliminated by THIS round's strikes. */
function eliminatedNow(state: NhieState): string[] {
  if (!state.settings.elimination) return []
  return state.players
    .filter((p) => current(state)[p.id] && (state.strikes[p.id] ?? 0) === state.settings.strikes)
    .map((p) => p.nickname)
}

function yesNames(state: NhieState): string[] {
  return state.players.filter((p) => current(state)[p.id]).map((p) => p.nickname)
}

/** Never Have I Ever: private yes/no confessions with a configurable reveal. */
export const neverHaveIEver: GameDefinition<NhieState, NhieSettings, NhiePrompt> = {
  id: 'never-have-i-ever',
  minPlayers: 3,
  defaultSettings: {
    rounds: 10,
    answerSeconds: 20,
    revealSeconds: 10,
    revealMode: 'names',
    elimination: false,
    strikes: 3,
  },

  init({ players, prompts, settings, now }) {
    return {
      phase: 'answer',
      round: 1,
      prompts,
      players,
      answers: [{}],
      strikes: Object.fromEntries(players.map((p) => [p.id, 0])),
      settings: { ...settings, rounds: Math.min(settings.rounds, prompts.length) },
      deadline: now + settings.answerSeconds * 1000,
    }
  },

  reducer(state, action): NhieState {
    switch (action.type) {
      case 'PLAYER_INPUT': {
        if (state.phase !== 'answer') return state
        if (!state.players.some((p) => p.id === action.playerId)) return state
        if (isEliminated(state, action.playerId)) return state
        const done = (action.input as { done?: unknown })?.done
        if (typeof done !== 'boolean') return state

        const answers = [...state.answers]
        answers[state.round - 1] = { ...current(state), [action.playerId]: done }
        const next = { ...state, answers }
        const everyone = active(next).every((p) => answers[state.round - 1][p.id] !== undefined)
        return everyone ? toReveal(next, action.now) : next
      }
      case 'TIMER_EXPIRED':
      case 'HOST_ADVANCE':
        if (state.phase === 'answer') return toReveal(state, action.now)
        if (state.phase === 'reveal') return advance(state, action.now)
        return state
    }
  },

  playerView(state, playerId): NhiePlayerView {
    const prompt = state.prompts[state.round - 1]
    if (state.phase === 'answer') {
      return {
        phase: 'answer',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        yourAnswer: current(state)[playerId] ?? null,
        eliminated: isEliminated(state, playerId),
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        yesCount: yesNames(state).length,
        ...(state.settings.revealMode === 'names' ? { yesNames: yesNames(state) } : {}),
        yourAnswer: current(state)[playerId] ?? null,
        eliminatedNow: eliminatedNow(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state), elimination: state.settings.elimination }
  },

  hostView(state): NhieHostView {
    const prompt = state.prompts[state.round - 1]
    if (state.phase === 'answer') {
      return {
        phase: 'answer',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        answeredCount: Object.keys(current(state)).length,
        totalPlayers: active(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        prompt,
        yesCount: yesNames(state).length,
        ...(state.settings.revealMode === 'names' ? { yesNames: yesNames(state) } : {}),
        eliminatedNow: eliminatedNow(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state), elimination: state.settings.elimination }
  },

  isFinished: (state) => state.phase === 'finished',
}
```

- [x] **Step 3: PASS, lint, commit** — `git commit -m "feat: never-have-i-ever definition with reveal modes and elimination"`

---

### Task 5: Never Have I Ever content + UI + registration

**Files:** mirror Task 3 exactly — `packages/content/src/neverHaveIEver.ts`, `NhieHost.tsx`, `NhiePlay.tsx`, registry + switches.

- [x] **Step 1: Content** (`p(id, text)` helper as in Task 3; statements complete "Never have I ever…")

```ts
// family: 'broken a bone', 'stayed up all night', 'eaten food off the floor',
// 'forgotten someone's name mid-conversation', 'sung in the shower', 'lost a library book',
// 'talked to myself out loud', 'pretended to be asleep', 'been on TV', 'had a secret handshake'
// friends: 'missed a flight', 'fallen asleep at the movies', 'texted the wrong person',
// 'pretended to know a song', 'googled myself', 'laughed till I cried in public',
// 'forgotten a friend's birthday', 'lied about my age', 'walked into a glass door',
// 'returned a gift for the money'
// spicy: 'kissed someone whose name I didn't know', 'dated two people in the same week',
// 'checked a partner's phone', 'ghosted someone', 'been kicked out of a bar',
// 'gone skinny dipping', 'lied on a dating profile', 'had a crush on a coworker',
// 'sent a risky text and instantly regretted it', 'pretended to be single'
```
Build the three `ContentPack<NhiePrompt>` objects (`nhie-family-v1`, `nhie-friends-v1`, `nhie-spicy-v1`) with ids `nhie-fam-N` / `nhie-fri-N` / `nhie-spi-N`, exactly like Task 3's structure. Register in `packages/content/src/index.ts` under `'never-have-i-ever'`.

- [x] **Step 2: Components**

`NhiePlay.tsx` — answer phase: prompt + two big buttons "I have 🙋" / `onAnswer(true)` and "Never 😇" / `onAnswer(false)`, highlight selection (same ring pattern as `WyrPlay`), show "You're out — enjoy the show 🍿" instead of buttons when `view.eliminated`. Reveal phase: `yesCount` large, list `yesNames` when present, banner for `eliminatedNow`. Finished: `<Leaderboard rows={view.leaderboard} unit={view.elimination ? 'strikes' : '"I have"s'} />`.

`NhieHost.tsx` — answer phase: `Never have I ever {prompt.text}` big, `answeredCount/totalPlayers` + `Countdown`. Reveal: giant `yesCount`, names as pills when present, `eliminatedNow` callout, Next button (`onAdvance`). Finished: leaderboard + Back-to-lobby (`onEnd`). Follow `MltHost.tsx` structure and classes exactly.

- [x] **Step 3: Register** — server definitions map + both switch components, same pattern as Task 3.

- [x] **Step 4: Verify, commit**

```bash
pnpm test && pnpm --filter @hpg/web build && pnpm lint
git add -A && git commit -m "feat: never-have-i-ever content, screens, and registration"
```

---

### Task 6: Who Said That definition (TDD)

**Files:**
- Create: `packages/shared/src/games/whoSaidThat.ts`
- Test: `packages/shared/src/games/whoSaidThat.test.ts`
- Modify: `packages/shared/src/index.ts`

Who Said That is the engine's stress test: an answer-collection phase whose outputs become the rounds.

- [x] **Step 1: Failing tests**

`packages/shared/src/games/whoSaidThat.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { GamePlayer } from '../engine/types'
import type { WstState } from './whoSaidThat'
import { whoSaidThat } from './whoSaidThat'

const players: GamePlayer[] = [
  { id: 'p1', nickname: 'Ana', connected: true },
  { id: 'p2', nickname: 'Ben', connected: true },
  { id: 'p3', nickname: 'Cy', connected: true },
]
const prompts = [{ id: 'q1', text: 'strangest thing you believed as a child' }]
const settings = { answerSeconds: 60, guessSeconds: 30, revealSeconds: 10 }
const T0 = 1_000_000

function fresh(): WstState {
  return whoSaidThat.init({ players, prompts, settings, now: T0 })
}
function submit(s: WstState, playerId: string, text: string): WstState {
  return whoSaidThat.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { text }, now: T0 })
}
function guess(s: WstState, playerId: string, authorId: string): WstState {
  return whoSaidThat.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { authorId }, now: T0 })
}
function allSubmit(s: WstState): WstState {
  s = submit(s, 'p1', 'Clouds were solid')
  s = submit(s, 'p2', 'TV people lived in the TV')
  return submit(s, 'p3', 'The moon followed our car')
}

describe('who-said-that', () => {
  it('collects answers, rejecting blank and over-140-char text', () => {
    let s = submit(fresh(), 'p1', '   ')
    expect(s.answers).toEqual({})
    s = submit(s, 'p1', 'x'.repeat(141))
    expect(s.answers).toEqual({})
    s = submit(s, 'p1', 'Clouds were solid')
    expect(s.answers.p1).toBe('Clouds were solid')
    expect(s.phase).toBe('answer')
  })

  it('moves to guessing once everyone answered, with a deterministic order', () => {
    const a = allSubmit(fresh())
    const b = allSubmit(fresh())
    expect(a.phase).toBe('guess')
    expect(a.order).toHaveLength(3)
    expect(a.order).toEqual(b.order) // same inputs -> same shuffle (hash-based, testable)
  })

  it('the current answer\'s author cannot guess; others cannot guess themselves', () => {
    let s = allSubmit(fresh())
    const author = s.order[0]
    expect(guess(s, author, 'p1')).toEqual(s) // author blocked
    const guesser = players.find((p) => p.id !== author)!.id
    expect(guess(s, guesser, guesser)).toEqual(s) // self-guess blocked
  })

  it('reveals when all eligible guessed; correct guessers +1, author +1 per wrong guess', () => {
    let s = allSubmit(fresh())
    const author = s.order[0]
    const others = players.filter((p) => p.id !== author).map((p) => p.id)
    s = guess(s, others[0], author) // correct
    s = guess(s, others[1], others[0]) // wrong
    expect(s.phase).toBe('reveal')
    expect(s.scores[others[0]]).toBe(1)
    expect(s.scores[author]).toBe(1) // fooled one person
  })

  it('walks every answer then finishes', () => {
    let s = allSubmit(fresh())
    for (let turn = 0; turn < 3; turn++) {
      const author = s.order[turn]
      for (const p of players.filter((x) => x.id !== author)) s = guess(s, p.id, author)
      s = whoSaidThat.reducer(s, { type: 'HOST_ADVANCE', now: T0 + turn * 1000 })
    }
    expect(whoSaidThat.isFinished(s)).toBe(true)
  })

  it('answer-phase timeout drops non-submitters; fewer than 2 answers finishes the game', () => {
    let s = submit(fresh(), 'p1', 'Only me')
    s = whoSaidThat.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 60_000 })
    expect(s.phase).toBe('finished')
  })

  it('playerView marks the author\'s own answer without leaking it to others', () => {
    const s = allSubmit(fresh())
    const author = s.order[0]
    const authorView = whoSaidThat.playerView(s, author) as { isYours: boolean }
    const otherView = whoSaidThat.playerView(s, players.find((p) => p.id !== author)!.id) as {
      isYours: boolean
      candidates: Array<{ id: string }>
    }
    expect(authorView.isYours).toBe(true)
    expect(otherView.isYours).toBe(false)
    expect(otherView.candidates.length).toBe(2) // everyone but the guesser themself
  })
})
```

- [x] **Step 2: Run FAIL, then implement**

`packages/shared/src/games/whoSaidThat.ts`:
```ts
import type { GameDefinition, GamePlayer, TimedState } from '../engine/types'

export interface WstPrompt {
  id: string
  text: string
}

export interface WstSettings {
  answerSeconds: number
  guessSeconds: number
  revealSeconds: number
}

export interface WstState extends TimedState {
  phase: 'answer' | 'guess' | 'reveal' | 'finished'
  prompt: WstPrompt
  players: GamePlayer[]
  /** playerId -> their submitted answer */
  answers: Record<string, string>
  /** playerIds whose answers are shown, in display order; set when answering closes */
  order: string[]
  /** index into `order` — whose answer is on screen now */
  turn: number
  /** guesses[turn][guesserId] = suspected authorId */
  guesses: Array<Record<string, string>>
  scores: Record<string, number>
  settings: WstSettings
}

interface LeaderboardRow {
  playerId: string
  nickname: string
  score: number
}

export type WstPlayerView =
  | { phase: 'answer'; prompt: WstPrompt; submitted: boolean; deadline: number | null }
  | {
      phase: 'guess'
      prompt: WstPrompt
      turn: number
      totalTurns: number
      answerText: string
      /** true → this is YOUR answer: sit tight and act natural */
      isYours: boolean
      candidates: Array<{ id: string; nickname: string }>
      yourGuess: string | null
      deadline: number | null
    }
  | {
      phase: 'reveal'
      prompt: WstPrompt
      turn: number
      totalTurns: number
      answerText: string
      authorNickname: string
      correctGuessers: string[]
      leaderboard: LeaderboardRow[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[] }

export type WstHostView =
  | { phase: 'answer'; prompt: WstPrompt; answeredCount: number; totalPlayers: number; deadline: number | null }
  | {
      phase: 'guess'
      prompt: WstPrompt
      turn: number
      totalTurns: number
      answerText: string
      guessedCount: number
      totalGuessers: number
      deadline: number | null
    }
  | {
      phase: 'reveal'
      prompt: WstPrompt
      turn: number
      totalTurns: number
      answerText: string
      authorNickname: string
      correctGuessers: string[]
      leaderboard: LeaderboardRow[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[] }

/**
 * Deterministic pseudo-shuffle: sort by a hash of playerId + prompt id.
 * Reducers must stay pure (no Math.random), and this is stable for tests
 * while looking arbitrary to players.
 */
function displayOrder(answerIds: string[], promptId: string): string[] {
  const hash = (s: string) => {
    let h = 0
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
    return h >>> 0
  }
  return [...answerIds].sort((a, b) => hash(a + promptId) - hash(b + promptId))
}

function active(state: WstState): GamePlayer[] {
  return state.players.filter((p) => p.connected)
}
function currentAuthor(state: WstState): string {
  return state.order[state.turn]
}
function currentGuesses(state: WstState): Record<string, string> {
  return state.guesses[state.turn] ?? {}
}
/** Everyone still connected except the current answer's author. */
function eligibleGuessers(state: WstState): GamePlayer[] {
  return active(state).filter((p) => p.id !== currentAuthor(state))
}

function leaderboard(state: WstState): LeaderboardRow[] {
  return state.players
    .map((p) => ({ playerId: p.id, nickname: p.nickname, score: state.scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score)
}

/** Close answering. With fewer than 2 answers there is nothing to guess — finish. */
function toGuessing(state: WstState, now: number): WstState {
  const order = displayOrder(Object.keys(state.answers), state.prompt.id)
  if (order.length < 2) return { ...state, phase: 'finished', order, deadline: null }
  return { ...state, phase: 'guess', order, turn: 0, guesses: [{}], deadline: now + state.settings.guessSeconds * 1000 }
}

/** Close guessing: +1 per correct guesser, +1 to the author per fooled guesser. */
function toReveal(state: WstState, now: number): WstState {
  const author = currentAuthor(state)
  const scores = { ...state.scores }
  for (const [guesser, suspect] of Object.entries(currentGuesses(state))) {
    if (suspect === author) scores[guesser] = (scores[guesser] ?? 0) + 1
    else scores[author] = (scores[author] ?? 0) + 1
  }
  return { ...state, phase: 'reveal', scores, deadline: now + state.settings.revealSeconds * 1000 }
}

function advance(state: WstState, now: number): WstState {
  if (state.turn + 1 >= state.order.length) return { ...state, phase: 'finished', deadline: null }
  return {
    ...state,
    phase: 'guess',
    turn: state.turn + 1,
    guesses: [...state.guesses, {}],
    deadline: now + state.settings.guessSeconds * 1000,
  }
}

/**
 * Who Said That: everyone answers a personal question privately, then the
 * group guesses each answer's author. Points for spotting authors and for
 * going unspotted.
 */
export const whoSaidThat: GameDefinition<WstState, WstSettings, WstPrompt> = {
  id: 'who-said-that',
  minPlayers: 3,
  defaultSettings: { answerSeconds: 90, guessSeconds: 45, revealSeconds: 12 },

  init({ players, prompts, settings, now }) {
    return {
      phase: 'answer',
      prompt: prompts[0],
      players,
      answers: {},
      order: [],
      turn: 0,
      guesses: [],
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      settings,
      deadline: now + settings.answerSeconds * 1000,
    }
  },

  reducer(state, action): WstState {
    switch (action.type) {
      case 'PLAYER_INPUT': {
        if (!state.players.some((p) => p.id === action.playerId)) return state

        if (state.phase === 'answer') {
          const text = (action.input as { text?: unknown })?.text
          if (typeof text !== 'string') return state
          const trimmed = text.trim()
          if (trimmed.length === 0 || trimmed.length > 140) return state
          const next = { ...state, answers: { ...state.answers, [action.playerId]: trimmed } }
          const everyone = active(next).every((p) => next.answers[p.id] !== undefined)
          return everyone ? toGuessing(next, action.now) : next
        }

        if (state.phase === 'guess') {
          const authorId = (action.input as { authorId?: unknown })?.authorId
          if (typeof authorId !== 'string') return state
          // The author sits this one out; nobody may point at themselves.
          if (action.playerId === currentAuthor(state)) return state
          if (authorId === action.playerId) return state
          if (!state.players.some((p) => p.id === authorId)) return state

          const guesses = [...state.guesses]
          guesses[state.turn] = { ...currentGuesses(state), [action.playerId]: authorId }
          const next = { ...state, guesses }
          const everyone = eligibleGuessers(next).every((p) => guesses[state.turn][p.id])
          return everyone ? toReveal(next, action.now) : next
        }
        return state
      }
      case 'TIMER_EXPIRED':
      case 'HOST_ADVANCE':
        if (state.phase === 'answer') return toGuessing(state, action.now)
        if (state.phase === 'guess') return toReveal(state, action.now)
        if (state.phase === 'reveal') return advance(state, action.now)
        return state
    }
  },

  playerView(state, playerId): WstPlayerView {
    if (state.phase === 'answer') {
      return {
        phase: 'answer',
        prompt: state.prompt,
        submitted: state.answers[playerId] !== undefined,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'guess') {
      const isYours = currentAuthor(state) === playerId
      return {
        phase: 'guess',
        prompt: state.prompt,
        turn: state.turn + 1,
        totalTurns: state.order.length,
        answerText: state.answers[currentAuthor(state)],
        isYours,
        candidates: isYours
          ? []
          : state.players.filter((p) => p.id !== playerId).map(({ id, nickname }) => ({ id, nickname })),
        yourGuess: currentGuesses(state)[playerId] ?? null,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      const author = state.players.find((p) => p.id === currentAuthor(state))
      return {
        phase: 'reveal',
        prompt: state.prompt,
        turn: state.turn + 1,
        totalTurns: state.order.length,
        answerText: state.answers[currentAuthor(state)],
        authorNickname: author?.nickname ?? '?',
        correctGuessers: state.players
          .filter((p) => currentGuesses(state)[p.id] === currentAuthor(state))
          .map((p) => p.nickname),
        leaderboard: leaderboard(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  hostView(state): WstHostView {
    if (state.phase === 'answer') {
      return {
        phase: 'answer',
        prompt: state.prompt,
        answeredCount: Object.keys(state.answers).length,
        totalPlayers: active(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'guess') {
      return {
        phase: 'guess',
        prompt: state.prompt,
        turn: state.turn + 1,
        totalTurns: state.order.length,
        answerText: state.answers[currentAuthor(state)],
        guessedCount: Object.keys(currentGuesses(state)).length,
        totalGuessers: eligibleGuessers(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      const author = state.players.find((p) => p.id === currentAuthor(state))
      return {
        phase: 'reveal',
        prompt: state.prompt,
        turn: state.turn + 1,
        totalTurns: state.order.length,
        answerText: state.answers[currentAuthor(state)],
        authorNickname: author?.nickname ?? '?',
        correctGuessers: state.players
          .filter((p) => currentGuesses(state)[p.id] === currentAuthor(state))
          .map((p) => p.nickname),
        leaderboard: leaderboard(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  isFinished: (state) => state.phase === 'finished',
}
```

- [x] **Step 3: PASS, lint, commit** — `git commit -m "feat: who-said-that definition — submit, guess, reveal"`

---

### Task 7: Who Said That content + UI + registration

**Files:** mirror Task 3 — `packages/content/src/whoSaidThat.ts`, `WstHost.tsx`, `WstPlay.tsx`, registry + switches.

- [x] **Step 1: Content** (`ContentPack<WstPrompt>` ×3, ids `wst-*-v1`; questions ask for short personal answers)

```ts
// family: 'What did you want to be when you were five?', 'What's your weirdest food combo?',
// 'What would you buy first with a million dollars?', 'What's your most-used emoji?',
// 'What's the strangest thing you believed as a kid?', 'If you were an animal, which one?',
// 'What food could you eat every single day?', 'What's your guilty-pleasure TV show?',
// 'What would you do first if you were invisible for a day?', 'What's your hidden talent?'
// friends: 'What's the most embarrassing song you love?', 'What's the dumbest way you've injured yourself?',
// 'Which celebrity would you swap lives with?', 'What was your worst fashion phase?',
// 'What's the strangest compliment you've received?', 'What do you pretend to understand?',
// 'Which app wastes most of your time?', 'What's a hill you'll die on?',
// 'What's the weirdest dream you've had recently?', 'What's your most irrational fear?'
// spicy: 'Describe your worst date in one line', 'What's your most embarrassing crush?',
// 'What's the biggest red flag you've ignored?', 'What's the pettiest reason you rejected someone?',
// 'What's the worst pickup line you've used or received?', 'Who's your celebrity hall pass?',
// 'What's your most chaotic 2am decision?', 'What have you done to impress a crush?',
// 'What's your toxic trait in relationships?', 'Describe your ex in exactly three words'
```

- [x] **Step 2: Components**

`WstPlay.tsx` — answer phase: prompt + `<textarea maxLength={140}>` + submit button (disabled after `view.submitted`, showing "Answer in — waiting for the others…"). Guess phase: show `answerText` in a big quote card; if `view.isYours` show "This one's yours 🤫 act natural"; else render candidate buttons like `MltPlay` (`onGuess(id)` → `input({ authorId: id })`). Reveal: answer card + "— {authorNickname}", list `correctGuessers` ("Got it: Ana, Cy" or "Nobody guessed it! +2 for {author}"). Finished: `<Leaderboard rows={view.leaderboard} unit="points" />`.

`WstHost.tsx` — answer: prompt big + `answeredCount/totalPlayers` + Countdown. Guess: giant quote card with `answerText`, "Who said that?" heading, `guessedCount/totalGuessers` + Countdown. Reveal: author name huge, correct guessers, running leaderboard, Next (`onAdvance`). Finished: leaderboard + Back to lobby (`onEnd`). Follow `MltHost.tsx` structure and classes.

- [x] **Step 3: Register** — server definitions map + both switches (`onVote`-style wiring: `input({ text })` in answer phase comes from the textarea submit; `input({ authorId })` from candidate taps — `GamePlay.tsx` passes the raw `input` function to `WstPlay`).

- [x] **Step 4: Verify, commit**

```bash
pnpm test && pnpm --filter @hpg/web build && pnpm lint
git add -A && git commit -m "feat: who-said-that content, screens, and registration"
```

---

### Task 8: E2E + manual verification + milestone

- [x] **Step 1: One more e2e** — `apps/web/e2e/most-likely-to.spec.ts`: clone the WYR spec's join flow with 3 players, pick "Most Likely To" before starting, each player taps the first candidate button, assert the host shows the tally reveal ("Next" button visible).

- [x] **Step 2:** `pnpm test && pnpm lint && pnpm --filter @hpg/web e2e` — all green.

- [x] **Step 3: Manual verification** — one real session per game (host + 3 phone windows):
  - MLT: self not in candidate list; anonymous reveal shows counts only.
  - NHIE: answers hidden until reveal; reveal names correct; play once with `revealMode: 'count'` by temporarily changing the default and confirm anonymity (settings UI arrives in plan 5).
  - WST: author sees "yours — act natural"; author can't guess; fooling points awarded; reload a phone mid-guess and confirm seat restore.

- [x] **Step 4: Tag** — `git tag plan-3-four-games`

---

## Self-review notes

- **Spec coverage (plan-3 slice):** Most Likely To with anonymous-voting setting ✓; Never Have I Ever reveal modes (names/count = spec's anonymous mode), Story-Time hook deferred, elimination/strikes mode ✓; Who Said That submission→guess→reveal with author info-hiding ✓; all as pure definitions on the unchanged engine ✓; content ×3 tones each ✓.
- **Known deferrals:** per-game settings UI (rounds/reveal-mode/elimination toggles on the host screen) is plan 5 polish; defaults are sensible meanwhile.
- **Type consistency:** all three definitions implement `GameDefinition<State, Settings, Prompt>` from plan 2 Task 1 exactly; views passed through the plan-2 `RoomStateMsg.game.view` channel; no engine changes anywhere.

---

## Deviations (recorded during execution)

Executor: direct-implementation session on 2026-07-14, continuing from plan 2's environment.

- **MLT e2e uses `getByText(name, { exact: true })`.** Plain `getByText('Cy')` matches both the player pill and the `spicy 🔞` tone-picker button. `exact: true` disambiguates; runtime UI text unchanged.
- **NhiePlay eliminated view uses `You&apos;re out` (HTML entity).** React/Next lint rejects raw apostrophes in JSX text; the encoding renders identically.
- No wire-shape, error-string, or event-name changes vs the plan.
