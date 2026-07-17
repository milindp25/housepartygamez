# SEO Discoverability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make the already-existing marketing and per-game pages fully discoverable and share-ready: a sitemap, a robots policy, a canonical base URL, Open Graph / Twitter card metadata, a generated share image, and JSON-LD structured data — without touching any game logic or the socket layer.

**Architecture:** All SEO constants and pure builder functions live in one new module, `apps/web/src/lib/seo.ts`, so the sitemap, robots policy, layout metadata, and page-level structured data all draw from a single source of truth. Next.js 16 file conventions (`app/sitemap.ts`, `app/robots.ts`, `app/opengraph-image.tsx`) turn those builders into real routes. The builders are plain functions returning plain data, so every one of them is unit-testable in the existing vitest (node) setup; the file-convention wiring and metadata are verified by a production build plus `curl`.

**Tech Stack:** Next.js 16.2 (app router, `MetadataRoute`, `next/og` `ImageResponse`), React 19, TypeScript, vitest 3 (node environment), pnpm workspaces.

**Why relative imports in tested modules:** The web app has **no** vitest config and **no** path-alias plugin, so the `@/…` alias does not resolve under vitest. Every module that a unit test imports (`seo.ts`, `sitemap.ts`, `robots.ts`) MUST use **relative** imports (`./games`, `../lib/seo`). Non-tested files that only run inside Next (`layout.tsx`, `page.tsx`, the game page, the OG image) may keep using `@/…` — that alias resolves fine in the Next build.

**Why `<script>{JSON.stringify(...)}</script>` and not `dangerouslySetInnerHTML`:** The JSON-LD payload is built entirely from our own static constants and the in-repo `MARKETING_GAMES` registry — no user input ever reaches it — and the content contains no `<`, `>`, or `&` characters, so rendering it as a React text child of a `<script>` tag is both safe and correct. This avoids `dangerouslySetInnerHTML` (and the XSS surface it implies) entirely. If a future game description introduces a `<` character, switch that one injection to `dangerouslySetInnerHTML` with a `.replace(/</g, '\\u003c')` guard.

**Tech Stack test commands:**
- Web unit tests: `pnpm --filter @hpg/web test`
- Web build (this is also the web typecheck): `pnpm --filter @hpg/web build`
- Lint + format check: `pnpm lint` (run `pnpm format` first if it complains)

**Conventions to follow (from the existing code):**
- JSDoc on every exported symbol, matching the density of `apps/web/src/lib/games.ts`.
- Style differs per file: `apps/web/src/app/layout.tsx` uses **double quotes + semicolons**, while `apps/web/src/lib/*.ts` uses **single quotes + no semicolons**. **Match the file you are editing.** New `lib/` and `app/*.ts(x)` files added here follow the `lib/*.ts` style (single quotes, no semicolons).
- The public game registry is `MARKETING_GAMES` in `apps/web/src/lib/games.ts` (fields: `id`, `slug`, `name`, `tagline`, `description`, `minPlayers`, `maxPlayers`, `minutes`, `howTo`, `accent`). Do not duplicate it.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `apps/web/src/lib/seo.ts` | Create | Single source of truth: `SITE_URL`, `SITE_NAME`, `SITE_TAGLINE`, `LAST_MODIFIED`, `marketingRoutes()`, `gameJsonLd()`, `homeJsonLd()` |
| `apps/web/src/lib/seo.test.ts` | Create | Unit tests for every pure builder in `seo.ts` |
| `apps/web/src/app/sitemap.ts` | Create | `MetadataRoute.Sitemap` default export built from `marketingRoutes()` |
| `apps/web/src/app/robots.ts` | Create | `MetadataRoute.Robots` default export (allow content, disallow app screens, point to sitemap) |
| `apps/web/src/app/seo-routes.test.ts` | Create | Unit tests for the `sitemap.ts` and `robots.ts` default exports |
| `apps/web/src/app/opengraph-image.tsx` | Create | Default social share image via `next/og` `ImageResponse` |
| `apps/web/src/app/layout.tsx` | Modify | `metadataBase`, default `openGraph`/`twitter`, root canonical |
| `apps/web/src/app/page.tsx` | Modify | Home canonical + injected `WebSite` JSON-LD |
| `apps/web/src/app/games/[slug]/page.tsx` | Modify | Per-game canonical + `openGraph`, injected `Game` JSON-LD |

---

### Task 1: SEO constants and the marketing route list

Create the single source of truth. `SITE_URL` is read from `NEXT_PUBLIC_SITE_URL` so staging/preview deploys get correct absolute URLs, falling back to the production domain. `LAST_MODIFIED` is a fixed date constant (not `new Date()`) so the sitemap stays a statically-cached route and the tests are deterministic — bump it by hand when marketing content changes.

**Files:**
- Create: `apps/web/src/lib/seo.ts`
- Test: `apps/web/src/lib/seo.test.ts`

- [x] **Step 1: Write the failing test**

Create `apps/web/src/lib/seo.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { LAST_MODIFIED, SITE_NAME, SITE_URL, marketingRoutes } from './seo'
import { MARKETING_GAMES } from './games'

describe('SEO constants', () => {
  it('exposes an absolute, non-trailing-slash site URL', () => {
    expect(SITE_URL).toMatch(/^https?:\/\/[^/]+$/)
  })
  it('names the product', () => {
    expect(SITE_NAME).toBe('HousePartyGamez')
  })
  it('uses a fixed ISO date for last-modified (not a live clock)', () => {
    expect(LAST_MODIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('marketingRoutes', () => {
  it('lists the home route plus one per game, excluding app screens', () => {
    const routes = marketingRoutes()
    const paths = routes.map((r) => r.path)
    expect(paths).toContain('/')
    // App screens (/host, /join) are intentionally excluded — they are
    // transient controllers, not indexable content.
    expect(paths).not.toContain('/host')
    expect(paths).not.toContain('/join')
    for (const game of MARKETING_GAMES) {
      expect(paths).toContain(`/games/${game.slug}`)
    }
    expect(routes).toHaveLength(1 + MARKETING_GAMES.length)
  })
  it('gives the home route the highest priority', () => {
    const home = marketingRoutes().find((r) => r.path === '/')!
    const game = marketingRoutes().find((r) => r.path.startsWith('/games/'))!
    expect(home.priority).toBeGreaterThan(game.priority)
  })
})
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @hpg/web test`
Expected: FAIL — `./seo` does not exist (module resolution error).

- [x] **Step 3: Implement `seo.ts`**

Create `apps/web/src/lib/seo.ts`:

```ts
import { MARKETING_GAMES, type MarketingGame } from './games'

/** Product name, used in metadata, JSON-LD, and the OG image. */
export const SITE_NAME = 'HousePartyGamez'

/** One-line product description reused across metadata surfaces. */
export const SITE_TAGLINE = 'Party games everyone plays on their phones'

/**
 * Absolute origin of the deployed site, with no trailing slash. Read from
 * `NEXT_PUBLIC_SITE_URL` so preview/staging deploys emit correct absolute URLs
 * in the sitemap, canonicals, and Open Graph tags; falls back to production.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://housepartygamez.com'
).replace(/\/$/, '')

/**
 * Fixed last-modified date for sitemap entries. Deliberately a constant, not
 * `new Date()`, so `app/sitemap.ts` stays a statically-cached route and tests
 * are deterministic. Bump this when marketing/game content changes.
 */
export const LAST_MODIFIED = '2026-07-17'

/** One entry per indexable marketing route; consumed by `app/sitemap.ts`. */
export interface MarketingRoute {
  path: string
  priority: number
  changeFrequency: 'yearly' | 'monthly' | 'weekly'
}

/**
 * The full list of indexable routes: the landing page plus one static guide
 * per game. The interactive `/host` and `/join` screens are excluded — they
 * are per-session controllers with no durable content to index.
 */
export function marketingRoutes(): MarketingRoute[] {
  return [
    { path: '/', priority: 1, changeFrequency: 'weekly' },
    ...MARKETING_GAMES.map((game) => ({
      path: `/games/${game.slug}`,
      priority: 0.8,
      changeFrequency: 'monthly' as const,
    })),
  ]
}

/**
 * Structured data for one game guide page (schema.org `Game`). Lets search
 * engines show player-count and rich-result treatment for "how to play X".
 */
export function gameJsonLd(game: MarketingGame): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Game',
    name: game.name,
    description: game.description,
    url: `${SITE_URL}/games/${game.slug}`,
    numberOfPlayers: {
      '@type': 'QuantitativeValue',
      minValue: game.minPlayers,
      maxValue: game.maxPlayers,
    },
    genre: 'Party game',
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL },
  }
}

/** Structured data for the landing page (schema.org `WebSite`). */
export function homeJsonLd(): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description: SITE_TAGLINE,
    url: SITE_URL,
  }
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @hpg/web test`
Expected: PASS (the `marketingRoutes` and constants tests).

- [x] **Step 5: Commit**

```bash
git add apps/web/src/lib/seo.ts apps/web/src/lib/seo.test.ts
git commit -m "feat(web): add SEO constants and marketing route source of truth"
```

---

### Task 2: Sitemap route

Turn `marketingRoutes()` into a real `/sitemap.xml`. Next builds the XML from the array returned by the default export.

**Files:**
- Create: `apps/web/src/app/sitemap.ts`
- Test: `apps/web/src/app/seo-routes.test.ts`

- [x] **Step 1: Write the failing test**

Create `apps/web/src/app/seo-routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import sitemap from './sitemap'
import { SITE_URL, marketingRoutes } from '../lib/seo'

describe('sitemap', () => {
  it('emits one absolute-URL entry per marketing route', () => {
    const entries = sitemap()
    expect(entries).toHaveLength(marketingRoutes().length)
    for (const entry of entries) {
      expect(entry.url === SITE_URL || entry.url.startsWith(`${SITE_URL}/`)).toBe(true)
      expect(entry.lastModified).toBeDefined()
    }
  })
  it('maps the home route to the bare origin (no trailing slash)', () => {
    const home = sitemap().find((e) => e.url === SITE_URL)
    expect(home).toBeDefined()
    expect(home!.priority).toBe(1)
  })
})
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @hpg/web test`
Expected: FAIL — `./sitemap` does not exist.

- [x] **Step 3: Implement `sitemap.ts`**

Create `apps/web/src/app/sitemap.ts`:

```ts
import type { MetadataRoute } from 'next'
import { LAST_MODIFIED, SITE_URL, marketingRoutes } from '../lib/seo'

/**
 * `/sitemap.xml` for search engines. Built from the shared marketing route
 * list so it can never drift from the pages that actually exist. The home
 * route maps to the bare origin so its canonical and its sitemap URL match
 * exactly (a trailing slash would read as a different URL).
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return marketingRoutes().map((route) => ({
    url: route.path === '/' ? SITE_URL : `${SITE_URL}${route.path}`,
    lastModified: LAST_MODIFIED,
    changeFrequency: route.changeFrequency,
    priority: route.priority,
  }))
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @hpg/web test`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/app/sitemap.ts apps/web/src/app/seo-routes.test.ts
git commit -m "feat(web): generate sitemap.xml from the marketing route list"
```

---

### Task 3: Robots policy

Allow crawlers onto content, keep them off the transient app screens, and advertise the sitemap.

**Files:**
- Create: `apps/web/src/app/robots.ts`
- Test: `apps/web/src/app/seo-routes.test.ts` (extend)

- [x] **Step 1: Add the failing test**

Append to `apps/web/src/app/seo-routes.test.ts`:

```ts
import robots from './robots'

describe('robots', () => {
  it('allows crawling the root and disallows the app controllers', () => {
    const policy = robots()
    const rule = Array.isArray(policy.rules) ? policy.rules[0] : policy.rules
    expect(rule.allow).toBe('/')
    expect(rule.disallow).toEqual(['/host', '/join'])
  })
  it('points crawlers at the absolute sitemap URL', () => {
    expect(robots().sitemap).toBe(`${SITE_URL}/sitemap.xml`)
  })
})
```

- [x] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @hpg/web test`
Expected: FAIL — `./robots` does not exist.

- [x] **Step 3: Implement `robots.ts`**

Create `apps/web/src/app/robots.ts`:

```ts
import type { MetadataRoute } from 'next'
import { SITE_URL } from '../lib/seo'

/**
 * `/robots.txt`. Content pages are open to crawlers; `/host` and `/join` are
 * per-session controllers (no durable content, often bound to a live room) so
 * they are disallowed to keep them out of the index. The absolute sitemap URL
 * is advertised so crawlers discover every game guide.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/host', '/join'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `pnpm --filter @hpg/web test`
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/app/robots.ts apps/web/src/app/seo-routes.test.ts
git commit -m "feat(web): add robots.txt policy pointing at the sitemap"
```

---

### Task 4: Root metadata — base URL, Open Graph, Twitter, canonical

Give the whole site a `metadataBase` (required before any relative OG/canonical URL is legal) and a default social card. Per-page metadata inherits and overrides these.

**Files:**
- Modify: `apps/web/src/app/layout.tsx`

- [x] **Step 1: Replace the metadata export**

In `apps/web/src/app/layout.tsx`, add this import directly under the existing `import "./globals.css";` line:

```ts
import { SITE_NAME, SITE_TAGLINE, SITE_URL } from "@/lib/seo";
```

Then replace the entire existing `export const metadata` block (currently `{ title: {...}, description: "..." }`) with (note: double quotes + semicolons to match this file's existing style):

```ts
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "HousePartyGamez — Party games on every phone",
    template: "%s | HousePartyGamez",
  },
  description:
    "Host seven social party games on one shared screen while everyone plays from their phone.",
  applicationName: SITE_NAME,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: "HousePartyGamez — Party games on every phone",
    description: SITE_TAGLINE,
    url: SITE_URL,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "HousePartyGamez — Party games on every phone",
    description: SITE_TAGLINE,
  },
};
```

(`openGraph.images` / `twitter.images` are intentionally omitted — the `opengraph-image.tsx` file convention added in Task 5 injects `og:image` and `twitter:image` automatically, resolved against `metadataBase`.)

- [x] **Step 2: Verify the build type-checks**

Run: `pnpm --filter @hpg/web build`
Expected: build succeeds (no "metadataBase" or relative-URL errors).

- [x] **Step 3: Commit**

```bash
git add apps/web/src/app/layout.tsx
git commit -m "feat(web): add metadataBase, Open Graph, Twitter, and root canonical"
```

---

### Task 5: Default Open Graph / share image

Generate a branded 1200×630 share image at `/opengraph-image` so links unfurl with a real card in iMessage, Slack, Discord, X, etc. `next/og` renders it from JSX — no static asset to maintain.

**Files:**
- Create: `apps/web/src/app/opengraph-image.tsx`

- [x] **Step 1: Implement the OG image route**

Create `apps/web/src/app/opengraph-image.tsx`:

```tsx
import { ImageResponse } from 'next/og'
import { SITE_NAME, SITE_TAGLINE } from '@/lib/seo'

/** Alt text applied to the generated `og:image`. */
export const alt = 'HousePartyGamez — Party games everyone plays on their phones'

/** Standard Open Graph card dimensions. */
export const size = { width: 1200, height: 630 }

/** Emitted content type for the generated image. */
export const contentType = 'image/png'

/**
 * The default social share card, inherited by every route that does not
 * define its own. Rendered from JSX by `next/og`; colors mirror the app's
 * warm plum/flame palette so the card matches the product.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '80px',
          background: 'linear-gradient(135deg, #1C1420 0%, #2A1F2B 100%)',
          color: '#FDF4EC',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ fontSize: 34, letterSpacing: 6, color: '#FBBF24', textTransform: 'uppercase' }}>
          {SITE_NAME}
        </div>
        <div style={{ fontSize: 84, fontWeight: 800, lineHeight: 1.05, marginTop: 24 }}>
          {SITE_TAGLINE}
        </div>
        <div style={{ fontSize: 32, color: '#C4B3BC', marginTop: 32 }}>
          One shared screen. Every phone in the game.
        </div>
      </div>
    ),
    size,
  )
}
```

- [x] **Step 2: Verify the build**

Run: `pnpm --filter @hpg/web build`
Expected: build succeeds; the build output lists an `/opengraph-image` route.

- [x] **Step 3: Manual verification**

```bash
pnpm --filter @hpg/web dev &
sleep 4
curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:3000/opengraph-image   # → 200 image/png
curl -s http://localhost:3000/ | grep -oE '<meta property="og:image"[^>]*>' | head -1              # → present
kill %1
```

Expected: a `200 image/png`, and an `og:image` meta tag on the landing page.

- [x] **Step 4: Commit**

```bash
git add apps/web/src/app/opengraph-image.tsx
git commit -m "feat(web): generate default Open Graph share image"
```

---

### Task 6: Per-game canonical, Open Graph, and JSON-LD

Each game guide already sets a unique title + description. Add its own canonical URL, an Open Graph title/description/url, and a `Game` JSON-LD block for rich results. The JSON-LD builder was added in Task 1 — here we lock its behavior with a test and inject it.

**Files:**
- Modify: `apps/web/src/app/games/[slug]/page.tsx`
- Test: `apps/web/src/lib/seo.test.ts` (extend)

- [x] **Step 1: Add the failing test for the JSON-LD builders**

Append to `apps/web/src/lib/seo.test.ts`:

```ts
import { gameJsonLd, homeJsonLd } from './seo'

describe('gameJsonLd', () => {
  it('describes a game with an absolute url and player range', () => {
    const game = MARKETING_GAMES[0]
    const ld = gameJsonLd(game) as {
      '@type': string
      url: string
      numberOfPlayers: { minValue: number; maxValue: number }
    }
    expect(ld['@type']).toBe('Game')
    expect(ld.url).toBe(`${SITE_URL}/games/${game.slug}`)
    expect(ld.numberOfPlayers.minValue).toBe(game.minPlayers)
    expect(ld.numberOfPlayers.maxValue).toBe(game.maxPlayers)
  })
})

describe('homeJsonLd', () => {
  it('describes the site with an absolute url', () => {
    const ld = homeJsonLd() as { '@type': string; url: string }
    expect(ld['@type']).toBe('WebSite')
    expect(ld.url).toBe(SITE_URL)
  })
})
```

(`SITE_URL` and `MARKETING_GAMES` are already imported at the top of this test file from Task 1.)

- [x] **Step 2: Run the test to verify it passes**

Run: `pnpm --filter @hpg/web test`
Expected: PASS immediately — the builders exist from Task 1. These tests lock the shape the page depends on. (If they fail, Task 1 was not completed correctly; fix `seo.ts` first.)

- [x] **Step 3: Wire canonical + Open Graph + JSON-LD into the game page**

In `apps/web/src/app/games/[slug]/page.tsx`:

Add a sibling import directly below the existing `import { ... } from '@/lib/games'` block:

```ts
import { gameJsonLd } from '@/lib/seo'
```

Replace the `return` object inside `generateMetadata` (the `title` and `description` values stay identical) with:

```ts
  return {
    title: `Play ${game.name} Online with Friends`,
    description: getMarketingDescription(game),
    alternates: { canonical: `/games/${game.slug}` },
    openGraph: {
      type: 'article',
      title: `Play ${game.name} Online with Friends`,
      description: getMarketingDescription(game),
      url: `/games/${game.slug}`,
    },
  }
```

Then inject the structured data as the first child inside the returned `<div className="detail-page" …>` (immediately above the existing `<a className="skip-link" …>` line). The JSON-LD payload is trusted static data with no `<`/`>`/`&`, so a `<script>` text child is safe and correct:

```tsx
      <script type="application/ld+json">{JSON.stringify(gameJsonLd(game))}</script>
```

- [x] **Step 4: Run tests and build**

Run: `pnpm --filter @hpg/web test && pnpm --filter @hpg/web build`
Expected: unit tests PASS; build succeeds.

- [x] **Step 5: Manual verification**

```bash
pnpm --filter @hpg/web dev &
sleep 4
curl -s http://localhost:3000/games/mafia | grep -oE 'application/ld\+json|rel="canonical"|og:title' | sort -u
kill %1
```

Expected: `application/ld+json`, `rel="canonical"`, and `og:title` all present.

- [x] **Step 6: Commit**

```bash
git add "apps/web/src/app/games/[slug]/page.tsx" apps/web/src/lib/seo.test.ts
git commit -m "feat(web): per-game canonical, Open Graph, and Game JSON-LD"
```

---

### Task 7: Homepage JSON-LD

Give the landing page its `WebSite` structured data. The builder and its test already exist (Tasks 1 and 6); this task only injects it.

**Files:**
- Modify: `apps/web/src/app/page.tsx`

- [x] **Step 1: Inject the structured data**

In `apps/web/src/app/page.tsx`, add an import beneath the existing `import { MARKETING_GAMES } from '@/lib/games'` line:

```ts
import { homeJsonLd } from '@/lib/seo'
```

Then render the JSON-LD as the very first child of the component's top-level returned element (the outermost wrapper element in `page.tsx`'s JSX). Add it immediately inside that opening tag:

```tsx
      <script type="application/ld+json">{JSON.stringify(homeJsonLd())}</script>
```

Placement anywhere within the rendered `<body>` is valid for JSON-LD; first child of the top wrapper keeps it easy to find.

- [x] **Step 2: Build and verify**

Run: `pnpm --filter @hpg/web build`
Expected: build succeeds.

```bash
pnpm --filter @hpg/web dev &
sleep 4
curl -s http://localhost:3000/ | grep -c 'application/ld+json'   # → at least 1
kill %1
```

- [x] **Step 3: Commit**

```bash
git add apps/web/src/app/page.tsx
git commit -m "feat(web): add WebSite JSON-LD to the landing page"
```

---

### Task 8: Full verification pass

- [x] **Step 1: Run the whole web suite + build + lint**

Run:
```bash
pnpm --filter @hpg/web test && pnpm --filter @hpg/web build && pnpm lint
```
Expected: all green. (If `pnpm lint` complains about formatting, run `pnpm format` and re-run.)

- [x] **Step 2: End-to-end curl check against a dev server**

```bash
pnpm --filter @hpg/web dev &
sleep 4
echo '--- sitemap ---';  curl -s http://localhost:3000/sitemap.xml | head -20
echo '--- robots ---';   curl -s http://localhost:3000/robots.txt
echo '--- og image ---'; curl -s -o /dev/null -w '%{http_code} %{content_type}\n' http://localhost:3000/opengraph-image
echo '--- game page tags ---'; curl -s http://localhost:3000/games/bluff-battle | grep -oE 'rel="canonical"|og:title|og:image|application/ld\+json' | sort -u
kill %1
```

Expected: the sitemap lists 8 `<loc>` URLs (home + 7 games) with absolute URLs, robots shows the two `Disallow` lines and the `Sitemap:` line, the OG image returns `200 image/png`, and the game page shows canonical + OG + JSON-LD.

- [x] **Step 3: External validators (manual, do before/after launch)**

- Paste a deployed game URL into Google's Rich Results Test (<https://search.google.com/test/rich-results>) — confirm the `Game` item is detected with no errors.
- Paste the home URL into a social-card debugger (e.g. opengraph.xyz) — confirm the title, description, and image render.
- After deploy, submit `https://<domain>/sitemap.xml` in Google Search Console.

- [x] **Step 4: Final confirmation**

No separate commit — Tasks 1–7 each committed their own work. Confirm `git log --oneline -8` shows the seven feature commits and the working tree is clean.

---

## Out of Scope (deliberately)

- **Per-game bespoke OG images** — the single default card is enough for launch; per-game `opengraph-image.tsx` under `games/[slug]/` can come later if share CTR warrants it.
- **`hreflang` / i18n** — the site is English-only today.
- **Breadcrumb JSON-LD** — the visible breadcrumb is fine; structured breadcrumbs are a later polish.
- **Dynamic `lastModified` from git history** — a hand-bumped constant is simpler and keeps the sitemap statically cached.

---

## Self-Review

- **Spec coverage:** sitemap ✓ (Task 2), robots ✓ (Task 3), canonical/metadataBase ✓ (Task 4), Open Graph/Twitter ✓ (Tasks 4–6), share image ✓ (Task 5), JSON-LD ✓ (Tasks 1/6/7). Every gap named in the testing report has a task.
- **Placeholder scan:** every code step contains complete code; no TBD/TODO.
- **Type consistency:** `SITE_URL`, `SITE_NAME`, `SITE_TAGLINE`, `LAST_MODIFIED`, `marketingRoutes()`, `gameJsonLd()`, `homeJsonLd()` are defined once in Task 1 and referenced with identical names/signatures in Tasks 2–7. `MarketingRoute.path/priority/changeFrequency` match their test assertions.
