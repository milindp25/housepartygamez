# Plan 7: Bluff Battle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bluff Battle (Fibbage-style): a question with a surprising real answer; every player submits a believable fake; all answers (real + fakes, deduped) appear as options; players vote for the one they believe. Points for finding the truth and for fooling friends.

**Architecture:** One `GameDefinition` on the existing engine. Option order is the deterministic hash shuffle (as Who Said That). Identical bluffs merge into one option with multiple authors. The reducer prevents picking your own bluff and blocks bluffs that equal the real answer.

**Standards / Pre-flight:** as plan 6 (requires `plan-3-four-games`; independent of 4–6).

---

## File structure

```
packages/shared/src/games/bluffBattle.ts + .test.ts
packages/content/src/bluffBattle.ts       # question+answer packs ×3 tones
packages/content/src/index.ts             # MODIFIED
apps/web/src/components/host/BluffHost.tsx
apps/web/src/components/play/BluffPlay.tsx
apps/web/src/components/{host/GameHost,play/GamePlay}.tsx   # MODIFIED
apps/game-server/src/server.ts            # MODIFIED
apps/web/src/app/host/page.tsx            # MODIFIED: GAMES list
```

Flow per round: `bluff` (everyone types a fake answer) → `vote` (shuffled options on every phone; you can't pick options you authored) → `reveal` (truth + who fooled whom) → `finished` after N rounds.

Scoring: +2 for voting the real answer; +1 to a bluff's **each** author per player fooled by it.

---

### Task 1: Bluff Battle definition (TDD)

**Files:** `packages/shared/src/games/bluffBattle.ts` + `.test.ts`; export from shared index.

- [x] **Step 1: Failing tests**

`packages/shared/src/games/bluffBattle.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { GamePlayer } from '../engine/types'
import type { BluffState } from './bluffBattle'
import { bluffBattle } from './bluffBattle'

const players: GamePlayer[] = [
  { id: 'p1', nickname: 'Ana', connected: true },
  { id: 'p2', nickname: 'Ben', connected: true },
  { id: 'p3', nickname: 'Cy', connected: true },
]
const prompts = [{ id: 'q1', question: 'A group of flamingos is called a…', answer: 'Flamboyance' }]
const settings = { rounds: 1, bluffSeconds: 45, voteSeconds: 30, revealSeconds: 12 }
const T0 = 1_000_000

function fresh(): BluffState {
  return bluffBattle.init({ players, prompts, settings, now: T0 })
}
function bluff(s: BluffState, playerId: string, text: string): BluffState {
  return bluffBattle.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { text }, now: T0 })
}
function pick(s: BluffState, playerId: string, optionId: string): BluffState {
  return bluffBattle.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { optionId }, now: T0 })
}

describe('bluff-battle', () => {
  it('collects bluffs; rejects blanks, >100 chars, and the real answer', () => {
    let s = bluff(fresh(), 'p1', '  ')
    expect(Object.keys(s.bluffs)).toHaveLength(0)
    s = bluff(s, 'p1', 'x'.repeat(101))
    expect(Object.keys(s.bluffs)).toHaveLength(0)
    s = bluff(s, 'p1', 'flamboyance') // case-insensitive match with truth → rejected
    expect(Object.keys(s.bluffs)).toHaveLength(0)
    s = bluff(s, 'p1', 'A flock')
    expect(s.bluffs.p1).toBe('A flock')
  })

  it('builds vote options once everyone bluffed: truth + deduped bluffs', () => {
    let s = bluff(fresh(), 'p1', 'A flock')
    s = bluff(s, 'p2', 'a flock') // duplicate (case-insensitive) merges with p1's
    s = bluff(s, 'p3', 'A stand')
    expect(s.phase).toBe('vote')
    expect(s.options).toHaveLength(3) // truth, "A flock" (authors p1+p2), "A stand"
    const truth = s.options.find((o) => o.isTruth)!
    expect(truth.text).toBe('Flamboyance')
    const merged = s.options.find((o) => o.text === 'A flock')!
    expect(merged.authorIds.sort()).toEqual(['p1', 'p2'])
  })

  it('vote options order is deterministic for identical inputs', () => {
    const play = () => {
      let s = bluff(fresh(), 'p1', 'A flock')
      s = bluff(s, 'p2', 'A stand')
      s = bluff(s, 'p3', 'A blush')
      return s.options.map((o) => o.id)
    }
    expect(play()).toEqual(play())
  })

  it('players cannot vote for options they authored', () => {
    let s = bluff(fresh(), 'p1', 'A flock')
    s = bluff(s, 'p2', 'A stand')
    s = bluff(s, 'p3', 'A blush')
    const own = s.options.find((o) => o.authorIds.includes('p1'))!
    const before = s
    s = pick(s, 'p1', own.id)
    expect(s).toEqual(before)
  })

  it('scores +2 for truth-finders and +1 per fooled voter to bluff authors', () => {
    let s = bluff(fresh(), 'p1', 'A flock')
    s = bluff(s, 'p2', 'A stand')
    s = bluff(s, 'p3', 'A blush')
    const truth = s.options.find((o) => o.isTruth)!
    const p2Bluff = s.options.find((o) => o.authorIds.includes('p2'))!
    s = pick(s, 'p1', p2Bluff.id) // p1 fooled by p2
    s = pick(s, 'p2', truth.id) // p2 finds truth
    s = pick(s, 'p3', truth.id) // p3 finds truth
    expect(s.phase).toBe('reveal')
    expect(s.scores).toEqual({ p1: 0, p2: 3, p3: 2 }) // p2: +2 truth, +1 fooled p1
  })

  it('timer closes each phase; reveal advance finishes after last round', () => {
    let s = bluff(fresh(), 'p1', 'A flock')
    s = bluffBattle.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 45_000 }) // p2/p3 missed bluffing
    expect(s.phase).toBe('vote')
    s = bluffBattle.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 80_000 })
    expect(s.phase).toBe('reveal')
    s = bluffBattle.reducer(s, { type: 'HOST_ADVANCE', now: T0 + 95_000 })
    expect(bluffBattle.isFinished(s)).toBe(true)
  })

  it('playerView never marks which option is the truth before reveal', () => {
    let s = bluff(fresh(), 'p1', 'A flock')
    s = bluff(s, 'p2', 'A stand')
    s = bluff(s, 'p3', 'A blush')
    const view = bluffBattle.playerView(s, 'p1') as { options: Array<Record<string, unknown>> }
    for (const o of view.options) {
      expect(o).not.toHaveProperty('isTruth')
      expect(o).not.toHaveProperty('authorIds')
    }
  })
})
```

- [x] **Step 2: Run FAIL, then implement**

`packages/shared/src/games/bluffBattle.ts`:
```ts
import type { GameDefinition, GamePlayer, TimedState } from '../engine/types'

export interface BluffPrompt {
  id: string
  question: string
  answer: string
}

export interface BluffSettings {
  rounds: number
  bluffSeconds: number
  voteSeconds: number
  revealSeconds: number
}

/** One selectable answer in the vote phase. Truth flag + authors NEVER reach player views pre-reveal. */
export interface BluffOption {
  id: string
  text: string
  isTruth: boolean
  authorIds: string[]
}

export interface BluffState extends TimedState {
  phase: 'bluff' | 'vote' | 'reveal' | 'finished'
  round: number
  prompts: BluffPrompt[]
  players: GamePlayer[]
  /** bluff phase: playerId -> submitted fake answer (this round) */
  bluffs: Record<string, string>
  /** vote phase: built once when bluffing closes */
  options: BluffOption[]
  /** vote phase: voterId -> optionId */
  picks: Record<string, string>
  scores: Record<string, number>
  seed: number
  settings: BluffSettings
}

interface LeaderboardRow {
  playerId: string
  nickname: string
  score: number
}

export type BluffPlayerView =
  | {
      phase: 'bluff'
      round: number
      totalRounds: number
      question: string
      submitted: boolean
      deadline: number | null
    }
  | {
      phase: 'vote'
      round: number
      totalRounds: number
      question: string
      /** truth/authors stripped; `yours` marks options this player wrote (unpickable) */
      options: Array<{ id: string; text: string; yours: boolean }>
      yourPick: string | null
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      question: string
      truth: string
      results: Array<{ text: string; isTruth: boolean; authors: string[]; pickedBy: string[] }>
      leaderboard: LeaderboardRow[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[] }

export type BluffHostView =
  | {
      phase: 'bluff'
      round: number
      totalRounds: number
      question: string
      submittedCount: number
      totalPlayers: number
      deadline: number | null
    }
  | {
      phase: 'vote'
      round: number
      totalRounds: number
      question: string
      options: Array<{ id: string; text: string }>
      pickedCount: number
      totalPlayers: number
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      question: string
      truth: string
      results: Array<{ text: string; isTruth: boolean; authors: string[]; pickedBy: string[] }>
      leaderboard: LeaderboardRow[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[] }

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h >>> 0
}

const normalize = (s: string) => s.trim().toLowerCase()

function active(state: BluffState): GamePlayer[] {
  return state.players.filter((p) => p.connected)
}
function prompt(state: BluffState): BluffPrompt {
  return state.prompts[state.round - 1]
}
function nickname(state: BluffState, id: string): string {
  return state.players.find((p) => p.id === id)?.nickname ?? '?'
}

/**
 * Build vote options: the truth plus each distinct bluff (case-insensitive
 * dedup, co-authors merged). Order = hash shuffle so the truth's position
 * carries no signal.
 */
function buildOptions(state: BluffState): BluffOption[] {
  const byText = new Map<string, BluffOption>()
  for (const [playerId, text] of Object.entries(state.bluffs)) {
    const key = normalize(text)
    const existing = byText.get(key)
    if (existing) existing.authorIds.push(playerId)
    else byText.set(key, { id: `opt-${key.length}-${hash(key)}`, text, isTruth: false, authorIds: [playerId] })
  }
  const p = prompt(state)
  const options: BluffOption[] = [
    { id: `opt-truth-${hash(normalize(p.answer))}`, text: p.answer, isTruth: true, authorIds: [] },
    ...byText.values(),
  ]
  return options.sort((a, b) => hash(a.id + state.seed + state.round) - hash(b.id + state.seed + state.round))
}

function toVote(state: BluffState, now: number): BluffState {
  return { ...state, phase: 'vote', options: buildOptions(state), picks: {}, deadline: now + state.settings.voteSeconds * 1000 }
}

/** Close voting: +2 truth-finders; +1 per fooled voter to each author of the picked bluff. */
function toReveal(state: BluffState, now: number): BluffState {
  const scores = { ...state.scores }
  for (const [voter, optionId] of Object.entries(state.picks)) {
    const option = state.options.find((o) => o.id === optionId)
    if (!option) continue
    if (option.isTruth) scores[voter] = (scores[voter] ?? 0) + 2
    else for (const author of option.authorIds) scores[author] = (scores[author] ?? 0) + 1
  }
  return { ...state, phase: 'reveal', scores, deadline: now + state.settings.revealSeconds * 1000 }
}

function nextRound(state: BluffState, now: number): BluffState {
  if (state.round >= state.settings.rounds) return { ...state, phase: 'finished', deadline: null }
  return {
    ...state,
    phase: 'bluff',
    round: state.round + 1,
    bluffs: {},
    options: [],
    picks: {},
    deadline: now + state.settings.bluffSeconds * 1000,
  }
}

function leaderboard(state: BluffState): LeaderboardRow[] {
  return state.players
    .map((p) => ({ playerId: p.id, nickname: p.nickname, score: state.scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score)
}

function results(state: BluffState) {
  return state.options.map((o) => ({
    text: o.text,
    isTruth: o.isTruth,
    authors: o.authorIds.map((id) => nickname(state, id)),
    pickedBy: Object.entries(state.picks)
      .filter(([, optionId]) => optionId === o.id)
      .map(([voter]) => nickname(state, voter)),
  }))
}

/** Bluff Battle: invent a believable fake answer, then find the real one. */
export const bluffBattle: GameDefinition<BluffState, BluffSettings, BluffPrompt> = {
  id: 'bluff-battle',
  minPlayers: 3,
  defaultSettings: { rounds: 5, bluffSeconds: 60, voteSeconds: 45, revealSeconds: 15 },

  init({ players, prompts, settings, now }) {
    return {
      phase: 'bluff',
      round: 1,
      prompts,
      players,
      bluffs: {},
      options: [],
      picks: {},
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      seed: now,
      settings: { ...settings, rounds: Math.min(settings.rounds, prompts.length) },
      deadline: now + settings.bluffSeconds * 1000,
    }
  },

  reducer(state, action): BluffState {
    switch (action.type) {
      case 'PLAYER_INPUT': {
        if (!state.players.some((p) => p.id === action.playerId)) return state

        if (state.phase === 'bluff') {
          const text = (action.input as { text?: unknown })?.text
          if (typeof text !== 'string') return state
          const trimmed = text.trim()
          if (!trimmed || trimmed.length > 100) return state
          // A "bluff" equal to the truth would out the real answer — reject it.
          if (normalize(trimmed) === normalize(prompt(state).answer)) return state
          const bluffs = { ...state.bluffs, [action.playerId]: trimmed }
          const next = { ...state, bluffs }
          return active(next).every((p) => bluffs[p.id]) ? toVote(next, action.now) : next
        }

        if (state.phase === 'vote') {
          const optionId = (action.input as { optionId?: unknown })?.optionId
          if (typeof optionId !== 'string') return state
          const option = state.options.find((o) => o.id === optionId)
          if (!option || option.authorIds.includes(action.playerId)) return state
          const picks = { ...state.picks, [action.playerId]: optionId }
          const next = { ...state, picks }
          return active(next).every((p) => picks[p.id]) ? toReveal(next, action.now) : next
        }
        return state
      }
      case 'TIMER_EXPIRED':
      case 'HOST_ADVANCE':
        if (state.phase === 'bluff') return toVote(state, action.now)
        if (state.phase === 'vote') return toReveal(state, action.now)
        if (state.phase === 'reveal') return nextRound(state, action.now)
        return state
    }
  },

  playerView(state, playerId): BluffPlayerView {
    const q = prompt(state)
    if (state.phase === 'bluff') {
      return {
        phase: 'bluff',
        round: state.round,
        totalRounds: state.settings.rounds,
        question: q.question,
        submitted: state.bluffs[playerId] !== undefined,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'vote') {
      return {
        phase: 'vote',
        round: state.round,
        totalRounds: state.settings.rounds,
        question: q.question,
        // Strip isTruth/authorIds — phones must not be able to cheat via devtools.
        options: state.options.map((o) => ({ id: o.id, text: o.text, yours: o.authorIds.includes(playerId) })),
        yourPick: state.picks[playerId] ?? null,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        question: q.question,
        truth: q.answer,
        results: results(state),
        leaderboard: leaderboard(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  hostView(state): BluffHostView {
    const q = prompt(state)
    if (state.phase === 'bluff') {
      return {
        phase: 'bluff',
        round: state.round,
        totalRounds: state.settings.rounds,
        question: q.question,
        submittedCount: Object.keys(state.bluffs).length,
        totalPlayers: active(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'vote') {
      return {
        phase: 'vote',
        round: state.round,
        totalRounds: state.settings.rounds,
        question: q.question,
        options: state.options.map((o) => ({ id: o.id, text: o.text })), // TV shows options, never the truth
        pickedCount: Object.keys(state.picks).length,
        totalPlayers: active(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        question: q.question,
        truth: q.answer,
        results: results(state),
        leaderboard: leaderboard(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  isFinished: (state) => state.phase === 'finished',
}
```

- [x] **Step 3: PASS, lint, commit** — `git commit -m "feat: bluff-battle definition with dedup, anti-cheat views, fooling points"`

---

### Task 2: Content + UI + registration

- [x] **Step 1: Q&A packs** — `packages/content/src/bluffBattle.ts`, `ContentPack<BluffPrompt>` ×3 (`bluff-family-v1`…, ids `blf-fam-N`…):

```ts
// family (question / answer):
// 'A group of flamingos is called a…' / 'A flamboyance'
// 'A baby kangaroo is called a…' / 'A joey'
// 'The only mammal that can truly fly is the…' / 'Bat'
// 'Bananas grow pointing…' / 'Upward'
// 'A snail can sleep for up to…' / 'Three years'
// 'The dot over a lowercase i is called a…' / 'Tittle'
// 'Octopuses have this many hearts…' / 'Three'
// 'The Hawaiian pizza was invented in…' / 'Canada'
// 'A group of pugs is called a…' / 'A grumble'
// 'Honey never…' / 'Spoils'
// friends:
// 'In Switzerland it is illegal to own just one…' / 'Guinea pig'
// 'The fear of running out of phone battery is called…' / 'Nomophobia'
// 'The first thing ever sold on eBay was a broken…' / 'Laser pointer'
// 'Wombats poop in this shape…' / 'Cubes'
// 'The average person spends 6 months of their life waiting for…' / 'Red lights'
// 'In Japan you can buy this from vending machines…' / 'Live rhinoceros beetles'
// 'The world record for most T-shirts worn at once is…' / '260'
// 'Before alarm clocks, "knocker-uppers" woke people by…' / 'Tapping windows with sticks'
// 'The inventor of the Pringles can is buried in…' / 'A Pringles can'
// 'A cow-bison hybrid is called a…' / 'Beefalo'
// spicy:
// 'The average first kiss happens at age…' / '15'
// 'In one survey, 1 in 5 people admitted to doing THIS at a wedding…' / 'Hooking up with a guest'
// 'The most common place to hide a dating app is…' / 'A folder named Utilities'
// 'Historically, Victorians flirted using…' / 'Fans'
// 'The most-returned Valentine's gift is…' / 'Lingerie'
// '"Cuffing season" officially peaks in…' / 'December'
// 'The average breakup text is this many words…' / 'Seven'
// 'In ancient Rome, love potions commonly contained…' / 'Sweat'
// 'The #1 lie on dating profiles is about…' / 'Height'
// 'Speed dating was invented by a…' / 'Rabbi'
```
Register under `'bluff-battle'`.

- [x] **Step 2: Components** — follow the `WstPlay`/`WstHost` pattern (textarea submit, option buttons):
  - `BluffPlay.tsx`: **bluff** — question + input (maxLength 100) + submit; after submit "Bluff locked in 😈". Show the server no-op case: if submit doesn't stick (view still `submitted: false`), surface "That's the real answer — too easy! Try another." (client mirrors the reducer's truth-match rule for UX; server stays authoritative). **vote** — option buttons; `yours: true` options rendered disabled with a "yours" badge; tap → `input({ optionId })`. **reveal** — truth highlighted, each option with authors + who fell for it. **finished** — leaderboard.
  - `BluffHost.tsx`: **bluff** — question big + submitted counter + Countdown. **vote** — options grid (no truth marking!), picked counter + Countdown. **reveal** — truth banner, per-option authors/pickedBy, leaderboard, Next. **finished** — leaderboard + Back to lobby.

- [x] **Step 3: Register** — definitions map, both switches, `GAMES` list.

- [x] **Step 4: Verify + tag**

```bash
pnpm test && pnpm --filter @hpg/web build && pnpm lint
```
Manual (host + 3 phones): duplicate bluffs merge; own bluff unpickable; devtools websocket frames during vote contain **no** `isTruth`/`authorIds`; scoring matches the +2/+1 rules on the reveal.
```bash
git add -A && git commit -m "feat: bluff-battle content, screens, and registration"
git tag plan-7-bluff-battle
```

---

## Self-review notes

- **Spec coverage:** Classic Bluff Battle ✓ (points for truth + fooling); trivia/funny-fact content across tones ✓; anti-cheat via stripped player views ✓. Deferred per spec: Image Bluff, Headline Bluff, funniest-answer bonus votes, Speed mode (timer settings exist), custom packs already work via plan 4's parser (add a `question | answer` line format to `parsePackText` when plan 4 is done — one extra branch + test, note it in Deviations if plan 4 landed first).
- **Type consistency:** engine API untouched; `BluffOption.id` is assigned uniformly by deterministic shuffled position, so IDs are stable for identical inputs without leaking truth status or colliding on text hashes.
