# Plan 6: Imposter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Imposter (Classic + Category-hint): everyone secretly receives the same word except one player; players give spoken clues in a turn order shown on the TV, then vote for the suspected Imposter.

**Architecture:** One `GameDefinition` on the existing engine — no engine changes. The imposter is chosen deterministically from `init`'s `now` (reducers stay pure; unpredictable to players, reproducible in tests). Clues are spoken aloud in the room: the app facilitates (secret word screens, turn order, timers, voting) — it never collects clue text.

**Standards:** as all prior plans (JSDoc, lint, TDD; logging is already generic).

**Pre-flight:** plan 3 complete (`plan-3-four-games` tag). This plan is independent of plans 4–5 and may run before or after them. Follow the README Pre-flight rule.

---

## File structure

```
packages/shared/src/games/imposter.ts + .test.ts
packages/content/src/imposter.ts          # word packs ×3 tones (word + category)
packages/content/src/index.ts             # MODIFIED: register
apps/web/src/components/host/ImposterHost.tsx
apps/web/src/components/play/ImposterPlay.tsx
apps/web/src/components/{host/GameHost,play/GamePlay}.tsx   # MODIFIED: switch cases
apps/game-server/src/server.ts            # MODIFIED: definitions map
apps/web/src/app/host/page.tsx            # MODIFIED: GAMES list entry
```

Game flow per round: `word` (everyone privately reads their word / imposter sees hint; ready-up or timer) → `clues` (TV shows speaking order; host advances each speaker or per-speaker timer) → `vote` (tap the suspect) → `reveal` (imposter unmasked, scores) → next round with a new word and new imposter → `finished`.

Scoring: each player who voted for the imposter +1; the imposter +2 if they are NOT the (strict) plurality vote-getter — ties mean the imposter escaped.

---

### Task 1: Imposter definition (TDD)

**Files:** `packages/shared/src/games/imposter.ts` + `.test.ts`; register export in `packages/shared/src/index.ts`.

- [x] **Step 1: Failing tests**

`packages/shared/src/games/imposter.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import type { GamePlayer } from '../engine/types'
import type { ImposterState } from './imposter'
import { imposter } from './imposter'

const players: GamePlayer[] = [
  { id: 'p1', nickname: 'Ana', connected: true },
  { id: 'p2', nickname: 'Ben', connected: true },
  { id: 'p3', nickname: 'Cy', connected: true },
  { id: 'p4', nickname: 'Di', connected: true },
]
const prompts = [
  { id: 'w1', word: 'Banana', category: 'Fruit' },
  { id: 'w2', word: 'Guitar', category: 'Instrument' },
]
const settings = { rounds: 2, hint: 'category' as const, clueSeconds: 25, voteSeconds: 30, revealSeconds: 10 }
const T0 = 1_000_000

function fresh(): ImposterState {
  return imposter.init({ players, prompts, settings, now: T0 })
}
function ready(s: ImposterState, playerId: string): ImposterState {
  return imposter.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { ready: true }, now: T0 })
}
function vote(s: ImposterState, playerId: string, suspectId: string): ImposterState {
  return imposter.reducer(s, { type: 'PLAYER_INPUT', playerId, input: { suspectId }, now: T0 })
}
function toVotePhase(s: ImposterState): ImposterState {
  for (const p of players) s = ready(s, p.id)
  // clues phase: host advances past each speaker
  for (let i = 0; i < players.length; i++) s = imposter.reducer(s, { type: 'HOST_ADVANCE', now: T0 })
  return s
}

describe('imposter', () => {
  it('assigns exactly one imposter deterministically from init time', () => {
    const a = fresh()
    const b = fresh()
    expect(a.imposterId).toBe(b.imposterId)
    expect(players.some((p) => p.id === a.imposterId)).toBe(true)
  })

  it('shows the word to everyone except the imposter, who gets the category hint', () => {
    const s = fresh()
    const civilian = players.find((p) => p.id !== s.imposterId)!.id
    const civView = imposter.playerView(s, civilian) as { word?: string; hint?: string; isImposter: boolean }
    const impView = imposter.playerView(s, s.imposterId) as { word?: string; hint?: string; isImposter: boolean }
    expect(civView).toMatchObject({ isImposter: false, word: s.prompts[0].word })
    expect(civView.hint).toBeUndefined()
    expect(impView.isImposter).toBe(true)
    expect(impView.word).toBeUndefined()
    expect(impView.hint).toBe('Fruit')
  })

  it('moves word -> clues when all ready, walking a full speaking order', () => {
    let s = fresh()
    for (const p of players) s = ready(s, p.id)
    expect(s.phase).toBe('clues')
    expect(s.speakingOrder).toHaveLength(4)
    expect(new Set(s.speakingOrder).size).toBe(4)
    for (let i = 0; i < 3; i++) {
      s = imposter.reducer(s, { type: 'HOST_ADVANCE', now: T0 })
      expect(s.phase).toBe('clues')
    }
    s = imposter.reducer(s, { type: 'HOST_ADVANCE', now: T0 })
    expect(s.phase).toBe('vote')
  })

  it('rejects self-votes and votes for the imposter from the imposter', () => {
    let s = toVotePhase(fresh())
    const before = s
    s = vote(s, 'p1', 'p1')
    expect(s).toEqual(before) // self-vote ignored
  })

  it('caught imposter: voters who fingered them score; imposter gets nothing', () => {
    let s = toVotePhase(fresh())
    const imp = s.imposterId
    const others = players.filter((p) => p.id !== imp).map((p) => p.id)
    s = vote(s, others[0], imp)
    s = vote(s, others[1], imp)
    s = vote(s, others[2], others[0])
    s = vote(s, imp, others[0])
    expect(s.phase).toBe('reveal')
    expect(s.scores[others[0]]).toBe(1)
    expect(s.scores[others[1]]).toBe(1)
    expect(s.scores[imp]).toBe(0) // strict plurality caught them (2 > 1+1? others[0] got 2 too...)
  })

  it('escaped imposter (tie or not top) earns +2', () => {
    let s = toVotePhase(fresh())
    const imp = s.imposterId
    const others = players.filter((p) => p.id !== imp).map((p) => p.id)
    // everyone piles on a civilian; only one correct vote
    s = vote(s, others[0], others[1])
    s = vote(s, others[1], others[0])
    s = vote(s, others[2], others[0])
    s = vote(s, imp, others[0])
    expect(s.phase).toBe('reveal')
    expect(s.scores[imp]).toBe(2)
  })

  it('rotates to a new word and (hash-)new imposter next round, then finishes', () => {
    let s = toVotePhase(fresh())
    for (const p of players) if (p.id !== s.imposterId) s = vote(s, p.id, s.imposterId)
    s = vote(s, s.imposterId, players.find((p) => p.id !== s.imposterId)!.id)
    s = imposter.reducer(s, { type: 'HOST_ADVANCE', now: T0 + 60_000 })
    expect(s.phase).toBe('word')
    expect(s.round).toBe(2)
    expect(s.prompts[1].word).toBe('Guitar')
    s = toVotePhase(s) // note: helper replays ready+clues on the current state
    for (const p of players) if (p.id !== s.imposterId) s = vote(s, p.id, s.imposterId)
    s = vote(s, s.imposterId, players.find((p) => p.id !== s.imposterId)!.id)
    s = imposter.reducer(s, { type: 'TIMER_EXPIRED', now: T0 + 90_000 })
    expect(imposter.isFinished(s)).toBe(true)
  })

  it('hint "none" leaves the imposter with no category', () => {
    const s = imposter.init({ players, prompts, settings: { ...settings, hint: 'none' }, now: T0 })
    const impView = imposter.playerView(s, s.imposterId) as { hint?: string }
    expect(impView.hint).toBeUndefined()
  })
})
```

Fix the "caught" test expectation while implementing: caught means the imposter is the **strict** top vote-getter. Construct the caught case as 3 votes on the imposter (others[0..2]) + imposter votes anywhere → imposter has 3, max other has 1 → caught; assert the three correct voters score 1 each and imposter scores 0. Keep the escaped case as written (imposter received 1 vote, a civilian received 3).

- [x] **Step 2: Run FAIL, then implement**

`packages/shared/src/games/imposter.ts`:
```ts
import type { GameDefinition, GamePlayer, TimedState } from '../engine/types'

export interface ImposterPrompt {
  id: string
  word: string
  category: string
}

export interface ImposterSettings {
  rounds: number
  /** 'category': the imposter sees the word's category; 'none': they fly blind. */
  hint: 'category' | 'none'
  clueSeconds: number
  voteSeconds: number
  revealSeconds: number
}

export interface ImposterState extends TimedState {
  phase: 'word' | 'clues' | 'vote' | 'reveal' | 'finished'
  round: number
  prompts: ImposterPrompt[]
  players: GamePlayer[]
  /** Chosen per round via seeded hash — see pickImposter. */
  imposterId: string
  /** Deterministic order in which players give spoken clues this round. */
  speakingOrder: string[]
  /** Index into speakingOrder during the clues phase. */
  speakerIndex: number
  /** word phase: playerId -> confirmed they've read their word */
  ready: Record<string, boolean>
  /** vote phase: voterId -> suspectId */
  votes: Record<string, string>
  scores: Record<string, number>
  /** Seed captured at init so per-round rotation stays pure AND unpredictable. */
  seed: number
  settings: ImposterSettings
}

interface LeaderboardRow {
  playerId: string
  nickname: string
  score: number
}

export type ImposterPlayerView =
  | {
      phase: 'word'
      round: number
      totalRounds: number
      isImposter: boolean
      word?: string
      hint?: string
      ready: boolean
      deadline: number | null
    }
  | {
      phase: 'clues'
      round: number
      totalRounds: number
      isImposter: boolean
      word?: string
      hint?: string
      currentSpeaker: string
      youAreSpeaking: boolean
      deadline: number | null
    }
  | {
      phase: 'vote'
      round: number
      totalRounds: number
      isImposter: boolean
      candidates: Array<{ id: string; nickname: string }>
      yourVote: string | null
      deadline: number | null
    }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      imposterNickname: string
      word: string
      caught: boolean
      tally: Array<{ nickname: string; count: number }>
      leaderboard: LeaderboardRow[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[] }

export type ImposterHostView =
  | { phase: 'word'; round: number; totalRounds: number; readyCount: number; totalPlayers: number; deadline: number | null }
  | {
      phase: 'clues'
      round: number
      totalRounds: number
      speakingOrder: string[]
      currentSpeaker: string
      deadline: number | null
    }
  | { phase: 'vote'; round: number; totalRounds: number; votedCount: number; totalPlayers: number; deadline: number | null }
  | {
      phase: 'reveal'
      round: number
      totalRounds: number
      imposterNickname: string
      word: string
      caught: boolean
      tally: Array<{ nickname: string; count: number }>
      leaderboard: LeaderboardRow[]
    }
  | { phase: 'finished'; leaderboard: LeaderboardRow[] }

function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return h >>> 0
}

/**
 * Round's imposter = lowest hash(playerId + seed + round). Pure and test-fixable
 * (fix `now` at init), but effectively random to players since seed is the
 * game's start timestamp.
 */
function pickImposter(players: GamePlayer[], seed: number, round: number): string {
  return [...players].sort((a, b) => hash(a.id + seed + round) - hash(b.id + seed + round))[0].id
}

function speakingOrder(players: GamePlayer[], seed: number, round: number): string[] {
  return [...players].sort((a, b) => hash(round + a.id + seed) - hash(round + b.id + seed)).map((p) => p.id)
}

function active(state: ImposterState): GamePlayer[] {
  return state.players.filter((p) => p.connected)
}

function tally(state: ImposterState): Map<string, number> {
  const t = new Map<string, number>()
  for (const suspect of Object.values(state.votes)) t.set(suspect, (t.get(suspect) ?? 0) + 1)
  return t
}

/** Caught = the imposter is the STRICT top vote-getter. A tie lets them slip away. */
function isCaught(state: ImposterState): boolean {
  const t = tally(state)
  const imposterVotes = t.get(state.imposterId) ?? 0
  if (imposterVotes === 0) return false
  return [...t.entries()].every(([id, n]) => id === state.imposterId || n < imposterVotes)
}

function toReveal(state: ImposterState, now: number): ImposterState {
  const scores = { ...state.scores }
  for (const [voter, suspect] of Object.entries(state.votes)) {
    if (suspect === state.imposterId && voter !== state.imposterId) scores[voter] = (scores[voter] ?? 0) + 1
  }
  if (!isCaught(state)) scores[state.imposterId] = (scores[state.imposterId] ?? 0) + 2
  return { ...state, phase: 'reveal', scores, deadline: now + state.settings.revealSeconds * 1000 }
}

function nextRound(state: ImposterState, now: number): ImposterState {
  if (state.round >= state.settings.rounds) return { ...state, phase: 'finished', deadline: null }
  const round = state.round + 1
  return {
    ...state,
    phase: 'word',
    round,
    imposterId: pickImposter(state.players, state.seed, round),
    speakingOrder: speakingOrder(state.players, state.seed, round),
    speakerIndex: 0,
    ready: {},
    votes: {},
    deadline: null, // word phase waits for ready-ups; host can advance
  }
}

function leaderboard(state: ImposterState): LeaderboardRow[] {
  return state.players
    .map((p) => ({ playerId: p.id, nickname: p.nickname, score: state.scores[p.id] ?? 0 }))
    .sort((a, b) => b.score - a.score)
}

function nickname(state: ImposterState, id: string): string {
  return state.players.find((p) => p.id === id)?.nickname ?? '?'
}

/**
 * Imposter: everyone shares a secret word except one player. Clues are spoken
 * out loud (the app shows whose turn it is); then the room votes.
 */
export const imposter: GameDefinition<ImposterState, ImposterSettings, ImposterPrompt> = {
  id: 'imposter',
  minPlayers: 4,
  defaultSettings: { rounds: 5, hint: 'category', clueSeconds: 25, voteSeconds: 45, revealSeconds: 12 },

  init({ players, prompts, settings, now }) {
    const seed = now
    return {
      phase: 'word',
      round: 1,
      prompts,
      players,
      imposterId: pickImposter(players, seed, 1),
      speakingOrder: speakingOrder(players, seed, 1),
      speakerIndex: 0,
      ready: {},
      votes: {},
      scores: Object.fromEntries(players.map((p) => [p.id, 0])),
      seed,
      settings: { ...settings, rounds: Math.min(settings.rounds, prompts.length) },
      deadline: null,
    }
  },

  reducer(state, action): ImposterState {
    switch (action.type) {
      case 'PLAYER_INPUT': {
        if (!state.players.some((p) => p.id === action.playerId)) return state

        if (state.phase === 'word') {
          if ((action.input as { ready?: unknown })?.ready !== true) return state
          const ready = { ...state.ready, [action.playerId]: true }
          const next = { ...state, ready }
          if (active(next).every((p) => ready[p.id])) {
            return { ...next, phase: 'clues', deadline: action.now + state.settings.clueSeconds * 1000 }
          }
          return next
        }

        if (state.phase === 'vote') {
          const suspect = (action.input as { suspectId?: unknown })?.suspectId
          if (typeof suspect !== 'string' || suspect === action.playerId) return state
          if (!state.players.some((p) => p.id === suspect)) return state
          const votes = { ...state.votes, [action.playerId]: suspect }
          const next = { ...state, votes }
          return active(next).every((p) => votes[p.id]) ? toReveal(next, action.now) : next
        }
        return state
      }
      case 'TIMER_EXPIRED':
      case 'HOST_ADVANCE': {
        if (state.phase === 'word') {
          return { ...state, phase: 'clues', deadline: action.now + state.settings.clueSeconds * 1000 }
        }
        if (state.phase === 'clues') {
          // Advance to the next speaker; after the last, open voting.
          if (state.speakerIndex + 1 < state.speakingOrder.length) {
            return {
              ...state,
              speakerIndex: state.speakerIndex + 1,
              deadline: action.now + state.settings.clueSeconds * 1000,
            }
          }
          return { ...state, phase: 'vote', deadline: action.now + state.settings.voteSeconds * 1000 }
        }
        if (state.phase === 'vote') return toReveal(state, action.now)
        if (state.phase === 'reveal') return nextRound(state, action.now)
        return state
      }
    }
  },

  playerView(state, playerId): ImposterPlayerView {
    const isImposter = state.imposterId === playerId
    const prompt = state.prompts[state.round - 1]
    // The secret: only non-imposters ever receive `word`; the imposter gets
    // `hint` (or nothing). This is enforced HERE, not in the client.
    const secret = isImposter
      ? state.settings.hint === 'category'
        ? { hint: prompt.category }
        : {}
      : { word: prompt.word }

    if (state.phase === 'word') {
      return {
        phase: 'word',
        round: state.round,
        totalRounds: state.settings.rounds,
        isImposter,
        ...secret,
        ready: state.ready[playerId] === true,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'clues') {
      return {
        phase: 'clues',
        round: state.round,
        totalRounds: state.settings.rounds,
        isImposter,
        ...secret,
        currentSpeaker: nickname(state, state.speakingOrder[state.speakerIndex]),
        youAreSpeaking: state.speakingOrder[state.speakerIndex] === playerId,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'vote') {
      return {
        phase: 'vote',
        round: state.round,
        totalRounds: state.settings.rounds,
        isImposter,
        candidates: state.players.filter((p) => p.id !== playerId).map(({ id, nickname: n }) => ({ id, nickname: n })),
        yourVote: state.votes[playerId] ?? null,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        imposterNickname: nickname(state, state.imposterId),
        word: prompt.word,
        caught: isCaught(state),
        tally: [...tally(state).entries()]
          .map(([id, count]) => ({ nickname: nickname(state, id), count }))
          .sort((a, b) => b.count - a.count),
        leaderboard: leaderboard(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  hostView(state): ImposterHostView {
    if (state.phase === 'word') {
      return {
        phase: 'word',
        round: state.round,
        totalRounds: state.settings.rounds,
        readyCount: Object.keys(state.ready).length,
        totalPlayers: active(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'clues') {
      return {
        phase: 'clues',
        round: state.round,
        totalRounds: state.settings.rounds,
        speakingOrder: state.speakingOrder.map((id) => nickname(state, id)),
        currentSpeaker: nickname(state, state.speakingOrder[state.speakerIndex]),
        deadline: state.deadline,
      }
    }
    if (state.phase === 'vote') {
      return {
        phase: 'vote',
        round: state.round,
        totalRounds: state.settings.rounds,
        votedCount: Object.keys(state.votes).length,
        totalPlayers: active(state).length,
        deadline: state.deadline,
      }
    }
    if (state.phase === 'reveal') {
      const prompt = state.prompts[state.round - 1]
      return {
        phase: 'reveal',
        round: state.round,
        totalRounds: state.settings.rounds,
        imposterNickname: nickname(state, state.imposterId),
        word: prompt.word,
        caught: isCaught(state),
        tally: [...tally(state).entries()]
          .map(([id, count]) => ({ nickname: nickname(state, id), count }))
          .sort((a, b) => b.count - a.count),
        leaderboard: leaderboard(state),
      }
    }
    return { phase: 'finished', leaderboard: leaderboard(state) }
  },

  isFinished: (state) => state.phase === 'finished',
}
```

**Also:** add `'imposter'` to the `GameId` union in `packages/shared/src/engine/types.ts` (and games 7–8's ids while there: `'bluff-battle'`, `'mafia'` — one edit instead of three).

- [x] **Step 3: PASS, lint, commit** — `git commit -m "feat: imposter game definition with hidden word and hash-seeded selection"`

---

### Task 2: Content + UI + registration

- [x] **Step 1: Word packs** — `packages/content/src/imposter.ts`, `ContentPack<ImposterPrompt>` ×3 (`imposter-family-v1` etc., ids `imp-fam-N`…):

```ts
// family (word / category): Banana/Fruit, Giraffe/Animal, Pizza/Food, Guitar/Instrument,
// Beach/Place, Rainbow/Nature, Dentist/Job, Soccer/Sport, Pancake/Food, Castle/Building
// friends: Karaoke/Activity, Road trip/Activity, Ghosting/Dating, Brunch/Food,
// Gym selfie/Social media, Group project/School, Wi-Fi password/Tech, Monday/Time,
// Escape room/Activity, Airport security/Travel
// spicy: First date/Dating, Situationship/Dating, Walk of shame/Night out, Love bite/Romance,
// Skinny dip/Activity, Ex's playlist/Music, Dating app bio/Tech, One-night stand/Dating,
// Body shot/Party, Friends with benefits/Dating
```
Register under `'imposter'` in `packages/content/src/index.ts`.

- [x] **Step 2: Components** — follow `MltHost`/`MltPlay` structure and classes:
  - `ImposterPlay.tsx`: **word** — full-screen card: non-imposter sees "The word is **{word}** — don't say it!", imposter sees "🕵️ You are the IMPOSTER{hint && ` — category: ${hint}`}. Blend in."; "Got it" button → `input({ ready: true })`. **clues** — persistent small banner with your word/imposter status + "🎤 {currentSpeaker} is giving a clue" (or "Your turn — say one clue out loud"). **vote** — candidate buttons → `input({ suspectId })`. **reveal** — imposter name + word + caught/escaped banner + leaderboard. **finished** — leaderboard.
  - `ImposterHost.tsx`: **word** — "Check your phones! {readyCount}/{totalPlayers} ready" (+ advance button). **clues** — speaking order list with the current speaker highlighted, Countdown, "Next speaker" button (`onAdvance`). **vote** — "{votedCount}/{totalPlayers} voted" + Countdown. **reveal** — big "The imposter was {imposterNickname}!" + word + tally + caught/escaped + Next. **finished** — leaderboard + Back to lobby.
  - The host page's word phase and clues use `onAdvance` — already wired generically.

- [x] **Step 3: Register** — server `definitions` map, `GameHost`/`GamePlay` switches, host page `GAMES` list (`{ id: 'imposter', name: 'Imposter' }`).

- [x] **Step 4: Verify + tag**

```bash
pnpm test && pnpm --filter @hpg/web build && pnpm lint
```
Manual (host + 4 phone windows): confirm the imposter's phone NEVER receives the word (check the websocket frames in devtools — this is the anti-cheat guarantee), turn order advances, caught vs escaped scoring both occur, imposter rotates next round.
```bash
git add -A && git commit -m "feat: imposter content, screens, and registration"
git tag plan-6-imposter
```

---

## Self-review notes

- **Spec coverage:** Classic + Category-hint modes as one `hint` setting ✓; per-player secret enforced in `playerView` (server-side) ✓; clue round facilitated, spoken aloud ✓; 4+ players ✓. Deferred modes per spec: Two Imposters, Related Word, Team/No-Talking/Quick (settings work later).
- **Purity:** imposter selection and speaking order derive from `hash(playerId + seed + round)` with `seed = init now` — pure, reproducible in tests, unpredictable at the table.

---

## Deviations (recorded during execution)

Executor: direct-implementation session on 2026-07-14, continuing from plan 3's environment. Plan 6 was implemented BACK-TO-BACK with plan 3 because plan 6 modifies plan 3's `GameHost`/`GamePlay` switches and depends on the game-dispatch refactor — true git-parallel branches would conflict at those merge points.

- **"Caught" test scoring case reshaped as the plan's Step 2 note directed.** The test snippet's original three-vote arrangement (2 imposter, 1 civilian) is a tie, not a strict plurality caught. Rewrote to 3 votes on imposter vs 1 elsewhere and asserted `scores[all three correct voters] === 1` and `scores[imposter] === 0`. Behavior + spec unchanged.
- **`GameId` union pre-declared all three plan 6-8 games** as the plan directed, so plans 7/8 will not need to widen it.
- **Anti-cheat proven at the wire level.** In addition to the plan's manual devtools check, a socket-level probe against the live server confirmed for real player sockets: exactly one imposter, imposter's `room:state` has `word === undefined` and a category `hint`, all civilians receive the same word with no hint. Also verified caught scoring end-to-end. Deleted the probe after use (it was a verification script, not a keeper).
- No wire-shape, error-string, or event-name changes vs the plan.
