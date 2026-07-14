# Launch Marketing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the default Next.js homepage with the approved House lights landing experience and generate useful, crawlable detail pages for all seven implemented games.

**Architecture:** A framework-agnostic typed registry owns all marketing data. Server-component routes render that registry into the landing page and statically generated `/games/[slug]` pages; a focused browser test verifies navigation, metadata, mobile overflow, and keyboard-visible actions. Global CSS supplies the shared launch token system without adding another font or component dependency.

**Tech Stack:** Next.js 16.2 App Router, React 19, TypeScript strict, Tailwind CSS 4 plus global CSS, Playwright 1.61.

## Global Constraints

- Implement the approved design in `docs/superpowers/specs/2026-07-14-launch-marketing-design.md`.
- Cover all seven implemented games: Would You Rather, Most Likely To, Never Have I Ever, Who Said That?, Imposter, Bluff Battle, and Mafia.
- Use `#070B16`, `#11182A`, `#F8FAFC`, `#7C3AED`, `#A3E635`, `#FB7185`, and `#22D3EE` as the launch palette.
- Use existing Geist Sans for display/body and Geist Mono for room codes and game data; add no font dependency.
- Marketing pages remain server components and require no database, authentication, analytics, or game-server connection at build time.
- Dynamic route `params` are `Promise<{ slug: string }>` in Next.js 16 and must be awaited.
- Every exported function/type has JSDoc; `pnpm lint` and the production build must pass.
- Support 320 px width without horizontal scrolling, visible keyboard focus, WCAG AA text contrast, and `prefers-reduced-motion`.

---

## File structure

```text
apps/web/src/lib/games.ts                  # typed seven-game marketing registry + lookup
apps/web/src/lib/games.test.ts             # registry invariants and lookup tests
apps/web/package.json                      # web unit-test command and Vitest dependency
pnpm-lock.yaml                             # resolved Vitest dependency
apps/web/src/app/page.tsx                  # House lights landing server component
apps/web/src/app/games/[slug]/page.tsx     # static metadata/detail pages
apps/web/src/app/globals.css               # launch tokens, marquee/card/focus/motion styles
apps/web/src/app/layout.tsx                 # real product metadata
apps/web/e2e/marketing.spec.ts              # navigation, metadata, mobile, unknown route
docs/superpowers/plans/2026-07-13-plan-5-launch.md # Task 4 checkbox + deviation
```

### Task 1: Typed seven-game marketing registry (TDD)

**Files:**
- Create: `apps/web/src/lib/games.ts`
- Create: `apps/web/src/lib/games.test.ts`
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `GameId` from `@hpg/shared`.
- Produces: `MarketingGame`, `MARKETING_GAMES`, and `getMarketingGame(slug)` for both routes.

- [x] **Step 1: Add the web unit-test runner**

Run `pnpm --filter @hpg/web add -D vitest@^3.2.7`, then add `"test": "vitest run src"` to the web package scripts so Playwright specs under `e2e/` are not collected. This is test infrastructure only; do not create production registry code yet.

- [x] **Step 2: Write the failing registry tests**

```ts
import { describe, expect, it } from 'vitest'
import { MARKETING_GAMES, getMarketingGame } from './games'

describe('marketing game registry', () => {
  it('contains seven unique slugs and engine ids with complete content', () => {
    expect(MARKETING_GAMES).toHaveLength(7)
    expect(new Set(MARKETING_GAMES.map((game) => game.slug)).size).toBe(7)
    expect(new Set(MARKETING_GAMES.map((game) => game.id)).size).toBe(7)
    for (const game of MARKETING_GAMES) {
      expect(game.description.split(/\s+/).length).toBeGreaterThanOrEqual(100)
      expect(game.description.split(/\s+/).length).toBeLessThanOrEqual(140)
      expect(game.howTo).toHaveLength(4)
      expect(game.howTo.every((step) => step.trim().length > 0)).toBe(true)
    }
  })

  it('looks up known slugs and returns undefined for unknown slugs', () => {
    expect(getMarketingGame('bluff-battle')?.id).toBe('bluff-battle')
    expect(getMarketingGame('not-a-game')).toBeUndefined()
  })
})
```

- [x] **Step 3: Run RED**

Run: `pnpm --filter @hpg/web exec vitest run src/lib/games.test.ts`  
Expected: fail because `./games` does not exist.

- [x] **Step 4: Add the registry**

Use this exact public shape:

```ts
import type { GameId } from '@hpg/shared'

/** One public marketing entry used by the landing and static game pages. */
export interface MarketingGame {
  id: GameId
  slug: string
  name: string
  tagline: string
  description: string
  minPlayers: number
  maxPlayers: number
  minutes: number
  howTo: readonly string[]
  accent: '#7C3AED' | '#A3E635' | '#FB7185' | '#22D3EE'
}

/** Find a public game by its stable URL slug. */
export function getMarketingGame(slug: string): MarketingGame | undefined {
  return MARKETING_GAMES.find((game) => game.slug === slug)
}
```

Export `MARKETING_GAMES` as a `readonly MarketingGame[]`, initialized directly with all seven literal entries in the display order specified below.

Write 100–140 word descriptions that accurately cover these exact mechanics:

```text
would-you-rather: choose between two dilemmas, private phone votes, shared reveal; 2–20 players; 10 minutes
most-likely-to: vote for the friend who fits a prompt, shared tally; 3–20; 15 minutes
never-have-i-ever: privately respond to statements, then share the classic/default count-and-names reveal; 3–20; 15 minutes
who-said-that: submit personal answers, then identify each answer's author; 3–20; 20 minutes
imposter: most players receive a shared word, one does not, spoken clues and vote; 4–20; 15 minutes
bluff-battle: invent fake trivia answers, find truth, score for truth and fooled friends; 3–20; 20 minutes
mafia: secret Mafia/Doctor/Detective/Civilian roles, night actions and day votes; marketing 6–20; 30 minutes
```

Each `howTo` array contains four imperative steps and does not claim deferred modes. Use accents in this order: iris, lime, coral, cyan, coral, lime, iris.

Correction (2026-07-14): these floors now match the shared engine definitions, and Never Have I Ever copy describes only the classic/default behavior exposed by the current host flow. Internal reveal/elimination settings are not marketed until the UI makes them selectable.

- [x] **Step 5: Run GREEN, full web unit tests, and lint**

Run:

```bash
pnpm --filter @hpg/web exec vitest run src/lib/games.test.ts
pnpm --filter @hpg/web test
pnpm --filter @hpg/web exec tsc --noEmit
pnpm lint
```

Expected: all pass with seven registry entries.

- [x] **Step 6: Commit**

```bash
git add apps/web/src/lib/games.ts apps/web/src/lib/games.test.ts apps/web/package.json pnpm-lock.yaml
git commit -m "feat: add seven-game marketing registry"
```

### Task 2: House lights landing and static game pages

**Files:**
- Replace: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/games/[slug]/page.tsx`
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/layout.tsx`

**Interfaces:**
- Consumes: `MARKETING_GAMES` and `getMarketingGame` from Task 1.
- Produces: `/`, seven static `/games/:slug` pages, and 404 behavior for other slugs.

- [x] **Step 1: Add a failing browser test for absent marketing UI**

Create `apps/web/e2e/marketing.spec.ts` with initial assertions for the approved headline, seven card links, and one detail route. Run it before replacing the starter page and observe failure.

- [x] **Step 2: Replace the product metadata**

In `layout.tsx`, keep the existing Geist setup and export:

```ts
export const metadata: Metadata = {
  title: {
    default: 'HousePartyGamez — Party games on every phone',
    template: '%s | HousePartyGamez',
  },
  description: 'Host seven social party games on one shared screen while everyone plays from their phone.',
}
```

- [x] **Step 3: Build the landing page**

The server component must render, in order:

```text
skip link → compact HousePartyGamez wordmark/header → asymmetric hero
hero copy + /host and /join CTAs → six-tile PARTY! room-code marquee
three real ordered steps → seven registry-driven game cards → closing CTA → footer
```

Use semantic `header`, `main`, `section`, `ol`, `article`, and `footer` elements. The primary CTA text is `Host a game`; the secondary is `Join a room`. Each game card links to `/games/${game.slug}` and exposes its player range and `${minutes} min` in monospaced metadata.

- [x] **Step 4: Build the static detail route**

Use the Next.js 16 signatures exactly:

```ts
type Props = { params: Promise<{ slug: string }> }

export const dynamicParams = false

/** Pre-render every implemented game detail page. */
export function generateStaticParams(): Array<{ slug: string }> {
  return MARKETING_GAMES.map(({ slug }) => ({ slug }))
}

/** Generate per-game search metadata from the public registry. */
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const game = getMarketingGame((await params).slug)
  if (!game) return { title: 'Game not found' }
  return { title: `Play ${game.name} Online with Friends`, description: game.description }
}

export default async function GamePage({ params }: Props) {
  const game = getMarketingGame((await params).slug)
  if (!game) notFound()
  // render breadcrumb, game name/tagline, description, player/time facts,
  // ordered how-to steps, Host {name} CTA, and All games link
}
```

- [x] **Step 5: Implement the visual system in `globals.css`**

Define the seven approved color variables, `color-scheme: dark`, a midnight radial stage-light background, visible `:focus-visible`, responsive `.marketing-shell`, `.hero-grid`, `.room-code-marquee`, `.game-grid`, and `.game-card` classes. At 720 px collapse the hero and game grids; at 360 px reduce marquee gap/tile padding. All animated transforms must be inside `@media (prefers-reduced-motion: no-preference)`.

- [x] **Step 6: Run browser GREEN, build, and lint**

Run:

```bash
pnpm --filter @hpg/web exec playwright test e2e/marketing.spec.ts
pnpm --filter @hpg/web build
pnpm lint
```

Expected: marketing test passes, build lists `/` plus seven static `/games/*` routes, lint/format clean.

- [x] **Step 7: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/app/games apps/web/src/app/globals.css apps/web/src/app/layout.tsx apps/web/e2e/marketing.spec.ts
git commit -m "feat: landing page and SEO game pages"
```

### Task 3: Marketing verification and Plan 5 bookkeeping

**Files:**
- Modify: `apps/web/e2e/marketing.spec.ts`
- Modify: `docs/superpowers/plans/2026-07-13-plan-5-launch.md`

- [ ] **Step 1: Complete the browser acceptance test**

Add assertions for:

```text
/ contains exact title/description metadata and both CTAs
all seven card hrefs resolve with one h1 and matching game name
/games/bluff-battle title is "Play Bluff Battle Online with Friends"
/games/not-a-game returns 404/noindex
keyboard Tab reaches Host then Join with visible focus outline
320x720 viewport has document.scrollWidth <= window.innerWidth
prefers-reduced-motion: reduce leaves marquee/card transforms at none
```

- [ ] **Step 2: Run the complete local acceptance matrix**

```bash
pnpm test
pnpm --filter @hpg/web build
pnpm lint
pnpm --filter @hpg/web e2e
```

Expected: all unit/socket tests, production build, lint, and the full browser suite pass.

- [ ] **Step 3: Update the original plan truthfully**

Check Plan 5 Task 4. Add a deviation explaining that the implemented catalog contains seven games because Plans 6–8 already landed. Do not check Lighthouse or production deployment steps.

- [ ] **Step 4: Commit verification/bookkeeping changes if any**

```bash
git add apps/web/e2e/marketing.spec.ts docs/superpowers/plans/2026-07-13-plan-5-launch.md
git commit -m "test: verify launch marketing pages"
```

If Step 3 was already committed with Task 2 and no tracked file changed, record that no extra commit was necessary.
