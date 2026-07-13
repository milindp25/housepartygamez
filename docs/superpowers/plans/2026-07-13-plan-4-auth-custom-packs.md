# Plan 4: Auth + Custom Question Packs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hosts can sign in with Google, create custom question packs for any game, and start rooms that use them. Players remain anonymous; nothing requires sign-in.

**Architecture:** Auth.js v5 (next-auth beta) with Google provider + Drizzle adapter on Postgres (Neon). Custom packs live in a `custom_packs` table using the same `ContentPack` JSON shape as built-ins. The game server never touches the DB: at `game:start` it resolves a `customPackId` by fetching the web app's public resolve endpoint (pack ids are unguessable UUIDs).

**Tech Stack:** next-auth@beta (Auth.js v5), @auth/drizzle-adapter, drizzle-orm, drizzle-kit, @neondatabase/serverless.

**Standards (apply to every task):** JSDoc on exports; `pnpm lint` before every commit; JSON log events on the game server (`custom_pack_resolved`, `custom_pack_fetch_failed`); TDD for validation logic.

**Pre-flight:** plan 2 complete (plan 3 recommended so packs cover all games); `pnpm test`/`lint` green; follow the README Pre-flight rule. **Requires from Milind:** a Neon database URL and Google OAuth credentials (see Task 1) — stop and ask if not provided.

---

## File structure

```
apps/web/
├── .env.local                       # DATABASE_URL, AUTH_SECRET, AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET (gitignored)
├── drizzle.config.ts
└── src/
    ├── db/
    │   ├── index.ts                 # drizzle client (neon-http)
    │   └── schema.ts                # Auth.js tables + custom_packs
    ├── auth.ts                      # Auth.js config (Google + Drizzle adapter)
    ├── lib/packValidation.ts        # pure: parse/validate pack prompt lines (+ test)
    ├── lib/packValidation.test.ts
    └── app/
        ├── api/auth/[...nextauth]/route.ts
        ├── api/packs/route.ts               # GET (mine) / POST (create)
        ├── api/packs/[id]/route.ts          # PUT / DELETE (owner only)
        ├── api/packs/[id]/resolve/route.ts  # GET public ContentPack JSON (for game server)
        └── packs/page.tsx                   # signed-in pack manager UI
apps/game-server/src/server.ts       # MODIFIED: game:start accepts customPackId
packages/shared/src/protocol.ts      # MODIFIED: game:start payload gains customPackId
apps/web/src/app/host/page.tsx       # MODIFIED: custom-pack picker for signed-in hosts
```

---

### Task 1: Environment + database schema

- [ ] **Step 1: Collect secrets (ask Milind if missing)**

`apps/web/.env.local` (never committed — verify `.env*.local` is gitignored):
```
DATABASE_URL=postgres://...           # from Neon dashboard (free tier)
AUTH_SECRET=...                       # `openssl rand -base64 32`
AUTH_GOOGLE_ID=...                    # Google Cloud Console OAuth client
AUTH_GOOGLE_SECRET=...
```
Google OAuth redirect URI for dev: `http://localhost:3000/api/auth/callback/google`.

- [ ] **Step 2: Install deps**

```bash
pnpm --filter @hpg/web add next-auth@beta @auth/drizzle-adapter drizzle-orm @neondatabase/serverless
pnpm --filter @hpg/web add -D drizzle-kit
```

- [ ] **Step 3: Schema**

`apps/web/src/db/schema.ts` — the four standard Auth.js tables (copy verbatim from the @auth/drizzle-adapter Postgres reference: `users`, `accounts`, `sessions`, `verificationTokens`) plus:
```ts
import { jsonb, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * A host-authored question pack. `prompts` stores the exact JSON prompt array
 * for the target game (same shape as built-in packs), validated at write time
 * by packValidation.ts.
 */
export const customPacks = pgTable('custom_packs', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  game: text('game').notNull(), // GameId
  prompts: jsonb('prompts').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
```

`apps/web/src/db/index.ts`:
```ts
import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

/** Single Drizzle client over Neon's HTTP driver (works in serverless runtimes). */
export const db = drizzle(neon(process.env.DATABASE_URL!), { schema })
```

`apps/web/drizzle.config.ts`:
```ts
import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
})
```

- [ ] **Step 4: Push schema, commit**

```bash
pnpm --filter @hpg/web exec drizzle-kit push   # creates tables on Neon
pnpm lint
git add apps/web && git commit -m "feat: postgres schema — auth tables and custom_packs"
```

---

### Task 2: Auth.js with Google

**Files:** `apps/web/src/auth.ts`, `apps/web/src/app/api/auth/[...nextauth]/route.ts`

- [ ] **Step 1: Config**

`apps/web/src/auth.ts`:
```ts
import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { db } from '@/db'

/**
 * Host-only authentication (spec: players never sign in). Google is the sole
 * provider; sessions are DB-backed so sign-in survives deployments.
 */
export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [Google],
  callbacks: {
    // Expose the user id so API routes can enforce pack ownership.
    session({ session, user }) {
      session.user.id = user.id
      return session
    },
  },
})
```

`apps/web/src/app/api/auth/[...nextauth]/route.ts`:
```ts
import { handlers } from '@/auth'

export const { GET, POST } = handlers
```

- [ ] **Step 2: Verify** — `pnpm dev:web`, visit `http://localhost:3000/api/auth/signin`, complete a Google sign-in, confirm a row lands in `users` (Neon console).

- [ ] **Step 3: Commit** — `git commit -m "feat: google sign-in via Auth.js with drizzle adapter"`

---

### Task 3: Pack validation (TDD)

**Files:** `apps/web/src/lib/packValidation.ts` + `.test.ts`

Hosts type one prompt per line in a textarea; Would You Rather lines are `option A | option B`. This parser is the only trust boundary between user text and stored pack JSON — it gets real tests.

- [ ] **Step 1: Failing tests**

`apps/web/src/lib/packValidation.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { parsePackText } from './packValidation'

describe('parsePackText', () => {
  it('parses would-you-rather "A | B" lines into WyrPrompt objects', () => {
    const res = parsePackText('would-you-rather', 'Fly | Be invisible\nBeach | Mountains')
    expect(res).toEqual({
      ok: true,
      prompts: [
        { id: 'custom-1', a: 'Fly', b: 'Be invisible' },
        { id: 'custom-2', a: 'Beach', b: 'Mountains' },
      ],
    })
  })

  it('rejects would-you-rather lines without exactly two options', () => {
    const res = parsePackText('would-you-rather', 'Fly | Swim | Run')
    expect(res).toEqual({ ok: false, error: 'Line 1: expected exactly "option A | option B"' })
  })

  it('parses text-prompt games one prompt per line, skipping blanks', () => {
    const res = parsePackText('most-likely-to', 'trip on nothing\n\n  cry at a movie  ')
    expect(res).toEqual({
      ok: true,
      prompts: [
        { id: 'custom-1', text: 'trip on nothing' },
        { id: 'custom-2', text: 'cry at a movie' },
      ],
    })
  })

  it('enforces 3–500 prompts and 200-char lines', () => {
    expect(parsePackText('most-likely-to', 'one\ntwo')).toEqual({
      ok: false,
      error: 'A pack needs between 3 and 500 prompts',
    })
    expect(parsePackText('most-likely-to', `ok\nok2\n${'x'.repeat(201)}`)).toEqual({
      ok: false,
      error: 'Line 3: prompts are limited to 200 characters',
    })
  })
})
```

- [ ] **Step 2: Run FAIL, then implement**

`apps/web/src/lib/packValidation.ts`:
```ts
import type { GameId } from '@hpg/shared'

export type ParseResult = { ok: true; prompts: unknown[] } | { ok: false; error: string }

const MIN_PROMPTS = 3
const MAX_PROMPTS = 500
const MAX_LINE = 200

/**
 * Turns host-typed textarea content into a validated prompt array for `game`.
 * Format: one prompt per line; would-you-rather lines are "option A | option B".
 * This is the ONLY path from user text into stored pack JSON — reject, never coerce.
 */
export function parsePackText(game: GameId, text: string): ParseResult {
  const lines = text.split('\n')
  const prompts: unknown[] = []
  let n = 0
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue
    if (line.length > MAX_LINE) return { ok: false, error: `Line ${i + 1}: prompts are limited to ${MAX_LINE} characters` }
    n++
    if (game === 'would-you-rather') {
      const parts = line.split('|').map((s) => s.trim())
      if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return { ok: false, error: `Line ${i + 1}: expected exactly "option A | option B"` }
      }
      prompts.push({ id: `custom-${n}`, a: parts[0], b: parts[1] })
    } else {
      prompts.push({ id: `custom-${n}`, text: line })
    }
  }
  if (prompts.length < MIN_PROMPTS || prompts.length > MAX_PROMPTS) {
    return { ok: false, error: `A pack needs between ${MIN_PROMPTS} and ${MAX_PROMPTS} prompts` }
  }
  return { ok: true, prompts }
}
```

Add vitest to the web app: `pnpm --filter @hpg/web add -D vitest` and script `"test": "vitest run"` (config-free; the test imports no Next.js internals).

- [ ] **Step 3: PASS, lint, commit** — `git commit -m "feat: custom pack text parser with validation"`

---

### Task 4: Packs API routes

**Files:** `apps/web/src/app/api/packs/route.ts`, `.../packs/[id]/route.ts`, `.../packs/[id]/resolve/route.ts`

- [ ] **Step 1: Implement**

`apps/web/src/app/api/packs/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { customPacks } from '@/db/schema'
import { parsePackText } from '@/lib/packValidation'
import type { GameId } from '@hpg/shared'

const GAME_IDS: GameId[] = ['would-you-rather', 'most-likely-to', 'never-have-i-ever', 'who-said-that']

/** Lists the signed-in host's packs (never anyone else's). */
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  const packs = await db.select().from(customPacks).where(eq(customPacks.userId, session.user.id))
  return NextResponse.json(packs.map(({ id, name, game, createdAt }) => ({ id, name, game, createdAt })))
}

/** Creates a pack from textarea content; body: { name, game, text }. */
export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  const body = (await req.json()) as { name?: string; game?: GameId; text?: string }
  const name = body.name?.trim()
  if (!name || name.length > 60) return NextResponse.json({ error: 'Name required (max 60 chars)' }, { status: 400 })
  if (!body.game || !GAME_IDS.includes(body.game)) return NextResponse.json({ error: 'Unknown game' }, { status: 400 })
  const parsed = parsePackText(body.game, body.text ?? '')
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const [row] = await db
    .insert(customPacks)
    .values({ userId: session.user.id, name, game: body.game, prompts: parsed.prompts })
    .returning({ id: customPacks.id })
  return NextResponse.json({ id: row.id }, { status: 201 })
}
```

`apps/web/src/app/api/packs/[id]/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { auth } from '@/auth'
import { db } from '@/db'
import { customPacks } from '@/db/schema'
import { parsePackText } from '@/lib/packValidation'
import type { GameId } from '@hpg/shared'

/** Owner-only update; body: { name?, text? } (game is immutable after creation). */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  const { id } = await params
  const [existing] = await db
    .select()
    .from(customPacks)
    .where(and(eq(customPacks.id, id), eq(customPacks.userId, session.user.id)))
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const body = (await req.json()) as { name?: string; text?: string }
  const updates: Partial<{ name: string; prompts: unknown[] }> = {}
  if (body.name?.trim()) updates.name = body.name.trim()
  if (body.text !== undefined) {
    const parsed = parsePackText(existing.game as GameId, body.text)
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
    updates.prompts = parsed.prompts
  }
  await db.update(customPacks).set(updates).where(eq(customPacks.id, id))
  return NextResponse.json({ ok: true })
}

/** Owner-only delete. */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Sign in required' }, { status: 401 })
  const { id } = await params
  const deleted = await db
    .delete(customPacks)
    .where(and(eq(customPacks.id, id), eq(customPacks.userId, session.user.id)))
    .returning({ id: customPacks.id })
  if (deleted.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
```

`apps/web/src/app/api/packs/[id]/resolve/route.ts`:
```ts
import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { customPacks } from '@/db/schema'

/**
 * Public by-id pack resolution for the game server. No auth: pack ids are
 * unguessable UUIDs and packs contain no personal data beyond their prompts —
 * the same information every player sees on screen during a game.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const [pack] = await db.select().from(customPacks).where(eq(customPacks.id, id))
  if (!pack) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({
    id: pack.id,
    game: pack.game,
    tone: 'friends', // custom packs carry no tone; treated as host-curated
    locale: 'en',
    prompts: pack.prompts,
  })
}
```

- [ ] **Step 2: Verify with curl** (signed-out 401s; then create/list/resolve with a browser session cookie), lint, commit — `git commit -m "feat: custom pack CRUD and public resolve API"`

---

### Task 5: Pack manager UI

**Files:** `apps/web/src/app/packs/page.tsx`

- [ ] **Step 1: Implement** — a client page that:
  - loads `useSession`-equivalent via a `GET /api/auth/session` fetch (or make the page a server component wrapper that calls `auth()` and passes the session down; sign-in button links to `/api/auth/signin`)
  - lists packs from `GET /api/packs` with edit/delete buttons
  - create/edit form: name input, game `<select>` over the four GameIds, big `<textarea>` with per-game placeholder (`Fly | Be invisible` for WYR, one-prompt-per-line otherwise), inline error display from the API
  - dark styling consistent with host/join pages (`bg-slate-950`, `bg-slate-800` cards, emerald primary buttons)

- [ ] **Step 2: Manual verify** — sign in, create a WYR pack with a bad line (see the exact line error), fix it, save, edit, delete. Lint, commit — `git commit -m "feat: pack manager page for signed-in hosts"`

---

### Task 6: Custom packs in game start

**Files:**
- Modify: `packages/shared/src/protocol.ts` (`game:start` payload), `apps/game-server/src/server.ts`, `apps/web/src/app/host/page.tsx`

- [ ] **Step 1: Protocol** — `game:start` payload becomes:
```ts
  'game:start': (
    payload: { gameId: GameId; tone: PackTone; rounds?: number; customPackId?: string },
    ack: (res: StartGameResult) => void,
  ) => void
```

- [ ] **Step 2: Server** — in the `game:start` handler, when `customPackId` is present, fetch instead of `getPack`:
```ts
      let pack = customPackId ? undefined : getPack(gameId, tone)
      if (customPackId) {
        try {
          const res = await fetch(`${process.env.WEB_ORIGIN ?? 'http://localhost:3000'}/api/packs/${customPackId}/resolve`)
          if (res.ok) {
            pack = (await res.json()) as ContentPack<unknown>
            if (pack.game !== gameId) pack = undefined // pack/game mismatch is a client bug
            log.info({ event: 'custom_pack_resolved', roomCode: code, customPackId })
          }
        } catch (err) {
          log.error({ event: 'custom_pack_fetch_failed', roomCode: code, customPackId, err: String(err) })
        }
      }
      if (!definition || !pack) { /* existing rejection path, error: 'Unknown game or pack' */ }
```
(The handler becomes `async`; everything after pack resolution is unchanged.)

- [ ] **Step 3: Host page** — when the host screen loads, fetch `GET /api/packs` (ignore 401 silently — anonymous hosts just don't see the section). If packs exist for the selected game, show them as extra tone-row chips ("📦 My pack name"); selecting one sends `customPackId` and skips the tone. Add a "Manage packs" link to `/packs`.

- [ ] **Step 4: Integration test** — append to `server.test.ts`: stub the fetch (`vi.stubGlobal('fetch', ...)`) to return a minimal WYR pack and assert `game:start` with `customPackId` starts the game with the stubbed prompts (host view shows the custom prompt text).

- [ ] **Step 5: Verify all, lint, commit** (tag moves to Task 7)

```bash
pnpm test && pnpm --filter @hpg/web build && pnpm lint
git add -A && git commit -m "feat: start games with custom packs"
```

Manual: sign in → create pack → host a room → pick your pack → play a round with your own prompts → confirm anonymous hosts still work end-to-end signed out.

---

### Task 7: Entitlements scaffolding (TDD)

Everything stays free in v1, but capability checks exist from day one so introducing paid plans later changes *data*, never game logic. **Rule (enforce in review): outside `entitlements.ts`, code never branches on a plan id — only on capabilities.**

**Files:**
- Create: `packages/shared/src/entitlements.ts`
- Test: `packages/shared/src/entitlements.test.ts`
- Modify: `packages/shared/src/index.ts`, `apps/game-server/src/roomManager.ts`, `apps/web/src/app/api/packs/route.ts`

- [ ] **Step 1: Failing test**

`packages/shared/src/entitlements.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { entitlementsFor, PLAN_ENTITLEMENTS } from './entitlements'

describe('entitlements', () => {
  it('defaults unknown/absent plans to FREE', () => {
    expect(entitlementsFor(null)).toEqual(PLAN_ENTITLEMENTS.FREE)
    expect(entitlementsFor(undefined)).toEqual(PLAN_ENTITLEMENTS.FREE)
  })

  it('every plan defines every capability (no partial plans)', () => {
    const keys = Object.keys(PLAN_ENTITLEMENTS.FREE).sort()
    for (const plan of Object.values(PLAN_ENTITLEMENTS)) {
      expect(Object.keys(plan).sort()).toEqual(keys)
    }
  })

  it('beta policy: FREE grants full access with a 20-player cap', () => {
    const free = entitlementsFor('FREE')
    expect(free.maxPlayers).toBe(20)
    expect(free.canUseCustomPacks).toBe(true)
  })
})
```

- [ ] **Step 2: Run FAIL, then implement**

`packages/shared/src/entitlements.ts`:
```ts
/**
 * Plans are DATA; game logic only ever reads capabilities. When pricing
 * launches, this table changes — nothing else does. (During the free beta,
 * FREE grants everything so no feature is gated in practice.)
 */
export type PlanId = 'FREE' | 'PARTY_PASS' | 'PLUS' | 'EVENT' | 'ADMIN'

export interface Entitlements {
  maxPlayers: number
  canUseCustomPacks: boolean
  canUsePremiumPacks: boolean
  canSaveHistory: boolean
  adFree: boolean
}

export const PLAN_ENTITLEMENTS: Record<PlanId, Entitlements> = {
  // Beta values: FREE = everything. Tighten via this table when pricing launches.
  FREE: { maxPlayers: 20, canUseCustomPacks: true, canUsePremiumPacks: true, canSaveHistory: false, adFree: true },
  PARTY_PASS: { maxPlayers: 20, canUseCustomPacks: true, canUsePremiumPacks: true, canSaveHistory: false, adFree: true },
  PLUS: { maxPlayers: 20, canUseCustomPacks: true, canUsePremiumPacks: true, canSaveHistory: true, adFree: true },
  EVENT: { maxPlayers: 20, canUseCustomPacks: true, canUsePremiumPacks: true, canSaveHistory: true, adFree: true },
  ADMIN: { maxPlayers: 20, canUseCustomPacks: true, canUsePremiumPacks: true, canSaveHistory: true, adFree: true },
}

/** Capability lookup; absent/unknown plans resolve to FREE. */
export function entitlementsFor(plan: PlanId | string | null | undefined): Entitlements {
  return PLAN_ENTITLEMENTS[(plan as PlanId) ?? 'FREE'] ?? PLAN_ENTITLEMENTS.FREE
}
```

Export from `packages/shared/src/index.ts`.

- [ ] **Step 3: Wire the two existing gates through capabilities**

- `apps/game-server/src/roomManager.ts`: delete the `MAX_PLAYERS = 20` constant; `createRoom()` sets `room.maxPlayers = entitlementsFor('FREE').maxPlayers` (host plan lookup arrives with payments) and `join()` checks `room.players.length >= room.maxPlayers`. Update the `Room` interface and the "Room full" test to construct via the manager (behavior unchanged at 20).
- `apps/web/src/app/api/packs/route.ts` POST: after the session check, add
  `if (!entitlementsFor('FREE').canUseCustomPacks) return NextResponse.json({ error: 'Not available on your plan' }, { status: 403 })`
  — a no-op today, but the seam exists where payments will need it.

- [ ] **Step 4: PASS all, lint, commit, tag**

```bash
pnpm test && pnpm lint
git add -A && git commit -m "feat: entitlements scaffolding — capability checks, plans as data"
git tag plan-4-auth-custom-packs
```

---

## Self-review notes

- **Spec coverage (plan-4 slice):** Auth.js + Google, hosts only ✓; Drizzle + Neon ✓; players anonymous ✓; custom packs same schema as built-ins ✓; game server fetches packs via web API at room creation (never touches DB) ✓; tables users/sessions/accounts + custom_packs ✓.
- **Security posture:** ownership enforced on list/update/delete; resolve is public-by-UUID (documented rationale in code); pack text validated server-side by the tested parser; no secrets in client code.
- **Type consistency:** `parsePackText` returns game-correct prompt shapes matching plan 2/3 prompt types (`WyrPrompt` `{id,a,b}`, others `{id,text}`); `ContentPack` shape from plan 2 reused for resolve payloads.
