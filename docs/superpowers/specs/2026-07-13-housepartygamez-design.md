# HousePartyGamez — v1 Design

**Date:** 2026-07-13
**Status:** Approved by Milind (brainstorming session)

## What we're building

A web-based house party game platform, Jackbox-style: a host opens a room on a TV/laptop
(the **host screen**), players join from their own phones via a 4-letter room code or QR,
and everyone plays together — public state on the TV, private screens on phones.

### v1 scope

Platform + the first 4 games from the catalog:

1. **Would You Rather** — two choices, secret vote, group-split reveal
2. **Most Likely To** — question shown, everyone secretly votes for a *player*, tally reveal
3. **Never Have I Ever** — statement shown, players answer yes/no, configurable reveal
   (names / count only / anonymous), optional strikes-elimination mode
4. **Who Said That** — players privately answer a question; answers are shown one at a
   time and everyone guesses the author

### Explicitly out of scope for v1

- Games 5–7 (Imposter, Bluff Battle, Mafia) — the architecture is designed so they slot in later
- Payments / free-premium split (all 4 games free in v1)
- Non-config "modes" (Guess the Lie, Debate Mode, Team Mode, Image Bluff, No Talking/drawing input)
- Localization (English only; content schema carries a `locale` field for later)
- Native apps (mobile-web only)

### Decisions made during brainstorming

| Question | Decision |
|---|---|
| Play model | Hybrid: shared TV/host screen + each player on their own phone |
| Realtime backend | Custom Node + Socket.IO server, rooms in memory |
| Frontend | Next.js + TypeScript (SEO landing pages + client-side game app) |
| v1 scope | Platform + first 4 games |
| Accounts | Google sign-in for hosts only (custom packs); players anonymous; no payments |
| Content | Family, Friends, and Spicy (18+ gate) packs per game, English |

## Architecture

Monorepo (pnpm workspaces), three deployables + shared packages:

```
housepartygamez/
├── apps/
│   ├── web/                  # Next.js (TypeScript, App Router) — deployed on Vercel
│   │   ├── marketing pages   #   / , /games/[game]  (SSR, SEO)
│   │   ├── /host             #   TV screen: create room, room code + QR, public game state
│   │   ├── /join/[code]      #   Phone controller: nickname entry, private view, voting
│   │   └── /api/…            #   Auth (Auth.js + Google), custom-pack CRUD
│   └── game-server/          # Node + Socket.IO (TypeScript) — deployed on Railway/Fly.io
│                             #   All live room state in memory; validates actions,
│                             #   runs timers, hides secret info per player
├── packages/
│   ├── shared/
│   │   ├── protocol/         #   Socket event types: client→server actions, server→client views
│   │   └── engine/           #   Game definitions as pure functions (see Round Engine)
│   └── content/              #   Question packs as JSON, versioned in git
│       └── <game>/{family,friends,spicy}.json
└── Postgres (hosted, e.g. Neon) — ONLY accounts + custom packs, never live game state
```

Key boundaries:

- **`packages/shared/engine`** — "given a game state and an action, what's the new state,
  and what does each player see?" Pure functions, zero I/O. Fully unit-testable.
- **`apps/game-server`** — "hold rooms in memory, run the engine, sync clients over sockets."
  Thin host for the engine; contains no game rules.
- **`apps/web`** — render whatever view the server sends, plus marketing, auth, pack management.
- **`packages/content`** — prompts as data; writing content never touches code.

Live game state never touches the database: rooms are ephemeral (~30 min), in-memory is
simpler and faster, and losing rooms on a rare server restart is acceptable at this stage.

Deployment note: Vercel doesn't host long-lived WebSocket servers, so the game server is a
separate small service. Clients connect to it directly; the room code routes to in-memory state.

## The Round Engine

Every game is a **game definition** plugged into one generic engine:

```ts
interface GameDefinition {
  id: GameId
  minPlayers: number
  settings: SettingsSchema            // rounds, timer length, pack, reveal style, …
  reducer(state, action): GameState   // the rules — pure, no I/O, no timers
  playerView(state, playerId): View   // what THIS player is allowed to see
  hostView(state): View               // what the TV shows
}
```

Common skeleton: `lobby → (prompt → collect → reveal) × N rounds → final scoreboard`.

- Games differ in prompt type, what a "vote" targets (option / player / yes-no / author
  guess), and reveal rules — all expressed inside their own reducer + views.
- Who Said That adds a submission phase whose outputs feed later rounds' prompts,
  deliberately included in v1 to prove the engine flexes.
- **Server-authoritative everything:** the game server receives actions over the socket,
  validates (is it your turn? right phase? already voted?), runs the reducer, then sends
  each client its own `playerView` and the TV its `hostView`. Timers live server-side and
  dispatch `TIMER_EXPIRED` actions into the same reducer.
- Per-player views are the information-hiding mechanism: a player's phone never receives
  data it shouldn't display. This later gives Imposter/Mafia hidden roles for free.

Catalog "modes" that are really settings (timer length, anonymity, imposter count, packs)
become fields in `settings` — not separate game definitions.

## Accounts & data

- **Auth.js (NextAuth) + Google provider**, sessions in Postgres via **Drizzle ORM** (Neon free tier).
- Hosts *may* sign in to create and save **custom question packs**. Nothing requires sign-in.
- Players never authenticate: nickname + room code only.
- Custom packs use the same schema as built-in packs and are fetched by the game server
  (via a web-app API call) at room creation.

DB tables (v1): `users`, `sessions`/`accounts` (Auth.js), `custom_packs`.

## Content

- JSON packs in `packages/content`: `{ id, game, tone, locale: 'en', prompts: [...] }`.
- Three tones per game at launch: **family**, **friends** (default), **spicy**.
- Spicy packs require the host to confirm an 18+ gate when selecting.
- Target ~100–150 prompts per game per tone (~1,200–1,800 total). Drafted with AI
  assistance, human-curated before ship.

## Resilience

- Each player gets a random `playerToken` in localStorage. Disconnect ≠ leave: the server
  holds their seat for the life of the room; reconnect restores identity + current view.
- The host screen is stateless — any device can reopen the host view with the room code.
- Timers advance the game past unresponsive players; nobody waits on a dead phone.
- Rooms auto-expire after ~1h of inactivity.
- Room codes: 4 letters from an unambiguous alphabet (no O/0, I/1 lookalikes).

## Product & pricing posture (reviewed 2026-07-13 against the cost-first architecture memo)

- **Launch completely free:** all 7 games, guest access, private rooms, no ads, no payment
  info, no mandatory registration. Measure (via PostHog) which games get picked, session
  length, drop-off points, and return rates before charging anything.
- **Entitlements as data from day one** (plan 4): a `PlanId → Entitlements` capability
  table (`maxPlayers`, `canUseCustomPacks`, `canUsePremiumPacks`, `canSaveHistory`,
  `adFree`). Hard rule: outside `entitlements.ts`, code never branches on a plan id —
  only on capabilities. Introducing Party Pass / Plus later changes the table, not logic.
  During the beta, FREE grants everything with a 20-player cap.
- **Candidate future tiers** (not built; the entitlement keys anticipate them):
  free (6-player cap, standard packs), Party Pass (~$4.99/24h: 20 players, premium +
  custom packs), Plus (~$5.99/mo: history, saved packs, early access).
- **Guest identity:** opaque random `playerToken` (localStorage), validated by server-side
  seat lookup — equivalent in security to a signed token for our server-authoritative
  model, with less machinery. Revisit (signed JWTs) only if room state ever moves to
  infrastructure that must validate tokens without shared memory.
- **Infra cost decision (reaffirmed):** Vercel + Railway + Neon (~$5/mo for Railway — the
  price of a game server with no cold starts). A $0 Cloudflare Durable Objects migration
  remains open at any time because the engine is pure TS with no server dependencies.
- **Room lifecycle:** empty lobbies expire after 30 min; active/finished rooms after 1h
  idle. Only durable data (accounts, packs) touches Postgres.
- **Deferred, noted for later milestones:** anonymous end-of-game summary rows in Postgres
  (feeds the Plus "game history" feature), player avatars, an instructions phase before
  round 1, moderation/report tables, sponsored screens.

## Engineering standards

- **TypeScript strict mode** everywhere; no `any` unless annotated with a reason.
- **Linting & formatting enforced by tooling**, not convention: ESLint (typescript-eslint
  recommended + Next.js config in the web app) and Prettier, run via `pnpm lint` /
  `pnpm format` and required to pass before commit.
- **Comments:** every exported function, class, and type carries a JSDoc block stating its
  purpose and any non-obvious behavior. Inline comments explain *why* (constraints,
  gotchas, protocol decisions), not *what* the next line does. Code should be readable by
  an engineer new to the repo.
- **Structured JSON logging** with **pino** on the game server (and web server-side code):
  one JSON object per line so any log aggregator (Railway, Datadog, Loki, CloudWatch) can
  index and search fields directly. Conventions:
  - every entry has an `event` name (`room_created`, `player_joined`, `join_rejected`, …)
    plus context fields (`roomCode`, `playerId`, `socketId`);
  - levels: `info` for lifecycle, `warn` for rejected/invalid client actions, `error` for
    exceptions;
  - dev uses pino-pretty for human-readable output; production stays raw JSON; tests are silent.
- **Analytics / click tracking:** **PostHog** on the web app (plan 5). Autocapture records
  every click/pageview without manual wiring; explicit funnel events (`room_created`,
  `player_joined`, `game_started`, `round_completed`) mirror the server log event names so
  product analytics and server logs correlate. Free tier ~1M events/month, EU hosting
  available, adds session replay + feature flags/A-B tests when we need them.

## Testing

- **Unit (Vitest):** reducers + view functions for every game — the bulk of all tests
  (e.g. "8 players, 2 unvoted, timer expires → phase becomes reveal").
- **Integration:** socket server in-process; simulate a 4-player game over real sockets,
  including a mid-round reconnect.
- **E2E (Playwright, thin):** one happy path — host creates room, 3 browser contexts
  join, one full Would You Rather round plays out.

## Build order within v1

1. Monorepo scaffold + room lifecycle (create/join/reconnect) + lobby on TV & phones
2. Round engine + **Would You Rather** end-to-end (proves the whole stack)
3. **Most Likely To** (player-targeted voting) — should be mostly a new definition + content
4. **Never Have I Ever** (reveal-style settings, elimination variant)
5. **Who Said That** (submission phase feeding rounds)
6. Auth + custom packs
7. Marketing pages, polish, deploy

Games 5–7 from the catalog (Imposter, Bluff Battle, Mafia) follow in later milestones,
in that order — Mafia last (roles, night/day phases, elimination, private actions).
