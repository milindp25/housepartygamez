# Plan 5: Launch — CI, Deploy, Marketing, Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The app is live: CI on every push, game server on Railway, web app on Vercel, SEO landing pages, PostHog click tracking + game funnels, QR codes on the host screen, and expanded content packs.

**Standards:** as all prior plans. Analytics event names mirror the server log event names (`room_created`, `player_joined`, `game_started`, `round_completed`) so product analytics and server logs correlate.

**Pre-flight:** plans 1–4 complete and tagged; all tests green. **Requires from Milind:** Vercel account, Railway (or Fly.io) account, a domain (optional), PostHog account (free tier). Stop and ask when a credential is needed.

---

### Task 1: CI (GitHub Actions)

**Files:** `.github/workflows/ci.yml`

- [ ] **Step 1:**
```yaml
name: CI
on:
  push: { branches: [main] }
  pull_request:
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm test
      - run: pnpm --filter @hpg/web build
        env: { SKIP_ENV_VALIDATION: '1' }
```
Note: the web build must not require live env vars — guard `DATABASE_URL!` usages so import-time access doesn't throw during build (lazy-init the db client if the plan-4 code didn't already).

- [ ] **Step 2:** Push a branch, confirm the workflow passes on GitHub, merge. Commit message: `ci: lint, test, and build on every push`.

---

### Task 2: Deploy game server (Railway)

- [ ] **Step 1:** Create a Railway project from the GitHub repo. Settings:
  - Root directory: repo root (pnpm workspace needs the lockfile); build command `pnpm install --frozen-lockfile`; start command `pnpm --filter @hpg/game-server start`.
  - Env vars: `NODE_ENV=production`, `CORS_ORIGIN=https://<your-vercel-domain>`, `WEB_ORIGIN=https://<your-vercel-domain>`.
- [ ] **Step 2:** Verify: `railway logs` shows the `server_started` JSON log line; open the Railway logs search and query `event:room_created` after hitting the URL with a quick socket client — this validates the JSON-log searchability requirement end-to-end.
- [ ] **Step 3:** Note the public URL (e.g. `hpg-game-server.up.railway.app`) for Task 3.

---

### Task 3: Deploy web app (Vercel)

- [ ] **Step 1:** Import the repo in Vercel; framework Next.js; root directory `apps/web` (enable "include files outside root" for the pnpm workspace).
- [ ] **Step 2:** Env vars: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `NEXT_PUBLIC_GAME_SERVER_URL=https://<railway-url>`. Add the production Google OAuth redirect URI (`https://<domain>/api/auth/callback/google`).
- [ ] **Step 3:** Deploy; play one full cross-device game over the internet (host on laptop, players on phones over cellular — this catches websocket/CORS issues local testing can't).

---

### Task 4: Landing + SEO game pages

**Files:**
- Create: `apps/web/src/lib/games.ts` (registry: slug, name, tagline, description, minPlayers, maxPlayers, minutes, howTo steps — content for all 4 games written out, ~120 words of description each)
- Create: `apps/web/src/app/page.tsx` — hero ("Party games everyone plays on their phones"), Host/Join CTAs, game cards from the registry
- Create: `apps/web/src/app/games/[slug]/page.tsx` — `generateStaticParams` over the registry; `generateMetadata` (title `Play {name} Online with Friends`, description from registry); page body: how-to-play steps, player count, duration, CTA to `/host`
- [ ] Build, lint, commit: `feat: landing page and SEO game pages`.

---

### Task 5: PostHog analytics

**Files:** `apps/web/src/app/providers.tsx`, `apps/web/src/lib/analytics.ts`; modify `layout.tsx`, host/join pages.

- [ ] **Step 1:** `pnpm --filter @hpg/web add posthog-js`. Env: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com`.

- [ ] **Step 2:**

`apps/web/src/lib/analytics.ts`:
```ts
'use client'
import posthog from 'posthog-js'

/** No-ops locally when no key is set — dev sessions never pollute product data. */
export function initAnalytics(): void {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!key || posthog.__loaded) return
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
    capture_pageview: true,
    autocapture: true, // click tracking with zero manual wiring
  })
}

/**
 * Funnel events use the SAME names as the game server's pino `event` field
 * (room_created, player_joined, game_started) so product analytics and
 * server logs correlate during debugging.
 */
export function track(event: string, props?: Record<string, unknown>): void {
  if (posthog.__loaded) posthog.capture(event, props)
}
```

`providers.tsx`: a `'use client'` component calling `initAnalytics()` in a `useEffect`, wrapped around `children` in `layout.tsx`.

- [ ] **Step 3:** Instrument the funnel: `track('room_created', { code })` in the host page's create ack; `track('player_joined', { code })` on successful join; `track('game_started', { gameId, tone })` in `startGame`. Autocapture covers everything else (every button press arrives as `$autocapture`).

- [ ] **Step 4:** Deploy, click around production, confirm events + session replay in PostHog. Commit: `feat: posthog analytics with autocapture and game funnel events`.

---

### Task 6: Host-screen QR code

- [ ] **Step 1:** `pnpm --filter @hpg/web add qrcode.react`. In the host lobby, next to the room code:
```tsx
import { QRCodeSVG } from 'qrcode.react'
// in the lobby JSX:
<QRCodeSVG value={`${window.location.origin}/join?code=${msg.code}`} size={160} bgColor="#0f172a" fgColor="#ffffff" />
```
(The join page already prefills from `?code=` — plan 1.)
- [ ] **Step 2:** Verify a real phone camera joins via the QR. Commit: `feat: QR code join on host screen`.

---

### Task 7: Content expansion (writing, not code)

- [ ] **Step 1:** Expand every pack in `packages/content` to **100+ prompts per game per tone** (spec target). Process per pack: generate candidates in bulk, then curate against this checklist — no duplicates or near-duplicates; family packs contain nothing requiring adult context; spicy stays playful (embarrassment-based, never explicit or targeting protected traits); every WYR pair is a genuine dilemma; every MLT prompt works for strangers AND close friends; ids stay stable (`wyr-fam-11`…) and append-only.
- [ ] **Step 2:** `pnpm test && pnpm --filter @hpg/content exec tsc --noEmit` (content is type-checked — a malformed prompt fails the build).
- [ ] **Step 3:** Commit per game: `content: expand <game> packs to 100+ prompts per tone`.

---

### Task 8: Launch checklist + milestone

- [ ] Full regression: `pnpm test && pnpm lint && pnpm --filter @hpg/web e2e`, then one real party test (4+ actual humans, real phones, production URL).
- [ ] Railway log search answers: rooms created today (`event:room_created`), join failures (`event:join_rejected`).
- [ ] PostHog shows the funnel: `room_created → player_joined → game_started`.
- [ ] Lighthouse on `/` and one `/games/*` page: performance + SEO ≥ 90.
- [ ] `git tag plan-5-launched` 🚀

---

## Self-review notes

- **Spec coverage (plan-5 slice):** deploy split Vercel/Railway ✓, marketing + per-game SEO pages ✓ (the Next.js-for-SEO decision pays off here), PostHog autocapture + funnel events mirroring log names ✓, QR join ✓, content to spec volume ✓, CI ✓.
- **Still deferred (post-v1, per spec):** games 5–7 (Imposter, Bluff Battle, Mafia), payments/premium, per-game settings UI, localization. Next planning session picks these up.
