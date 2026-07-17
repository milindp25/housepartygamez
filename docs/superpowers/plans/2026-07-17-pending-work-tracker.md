# Pending Work Tracker — Launch Readiness

**Owner:** milindp
**Last updated:** 2026-07-17
**Purpose:** One place that lists everything still outstanding before/around launch, with the exact test each item needs. This is a **tracker**, not an implementation plan — each substantial item links to its own plan document. Check items off here as their plans complete.

**Legend:** ⬜ not started · 🟡 in progress · ✅ done · 🔵 verify-only (no code)

---

## Snapshot

| # | Item | Status | Plan | Risk if skipped |
|---|---|---|---|---|
| 1 | SEO discoverability (sitemap, robots, OG, canonical, JSON-LD) | ✅ | [2026-07-17-seo-discoverability.md](2026-07-17-seo-discoverability.md) | — (implemented and verified locally) |
| 2 | Warm Living Room redesign (unify theme + 3 UX upgrades) | ✅ | [2026-07-16-warm-living-room-redesign.md](2026-07-16-warm-living-room-redesign.md) | — (implemented and verified locally) |
| 3 | Launch hardening (security, health, reconnect, CI) | ✅ | [2026-07-15-launch-hardening.md](2026-07-15-launch-hardening.md) | — (done & committed) |
| 4 | Full multi-user / anti-cheat / TV-mode QA pass | 🔵 | this doc, §4 | Regressions ship unnoticed |
| 5 | Pre-deploy ops checklist (env vars, CORS, domain) | 🟡 | this doc, §5 | Configuration is documented; production values still need to be set and verified |

---

## 1. SEO discoverability — ✅ DONE

**What already exists (verified 2026-07-17):** every game has its own statically-generated page at `/games/<slug>` with a unique `<title>`, meta description, full description, and a "How to play" rules list; all 7 return HTTP 200, a bad slug 404s, and they are linked from the landing grid.

Delivered 2026-07-17: `sitemap.xml`, `robots.txt`, `metadataBase`/canonical URLs, Open Graph and Twitter card metadata, a generated share image, and `WebSite`/`Game` JSON-LD structured data. A live local HTTP probe confirmed eight sitemap URLs, the host/join robots exclusions, `200 image/png` for the share image, and canonical/OG/Twitter/JSON-LD tags on the landing and game pages.

**Plan:** [2026-07-17-seo-discoverability.md](2026-07-17-seo-discoverability.md) (8 tasks, TDD, ~1 hour).

### How to test
- **Unit (vitest, per task):** `pnpm --filter @hpg/web test` — the plan adds pure builders (`marketingRoutes`, `gameJsonLd`, `homeJsonLd`) plus `sitemap()` / `robots()` default-export tests. Each task is red→green.
- **Build / typecheck:** `pnpm --filter @hpg/web build` must succeed (a missing `metadataBase` makes relative OG/canonical URLs a build error — the build is the gate).
- **Integration (dev server + curl):**
  ```bash
  pnpm --filter @hpg/web dev &
  sleep 4
  curl -s http://localhost:3000/sitemap.xml | grep -c '<loc>'                 # → 8 (home + 7 games)
  curl -s http://localhost:3000/robots.txt                                    # → Allow /, Disallow /host /join, Sitemap: line
  curl -s -o /dev/null -w '%{http_code} %{content_type}\n' \
       http://localhost:3000/opengraph-image                                  # → 200 image/png
  curl -s http://localhost:3000/games/mafia \
       | grep -oE 'rel="canonical"|og:title|og:image|application/ld\+json' | sort -u
  kill %1
  ```
- **External validators (manual, against the deployed URL):** Google Rich Results Test (the `Game` item parses cleanly), a social-card debugger (title/description/image render), and submitting `sitemap.xml` in Google Search Console.

### Acceptance criteria
- `/sitemap.xml` lists 8 absolute URLs; `/robots.txt` disallows `/host` + `/join` and links the sitemap.
- Every game page carries a canonical link, `og:title`/`og:image`, and a valid `Game` JSON-LD block.
- Landing page carries a `WebSite` JSON-LD block and canonical.
- `pnpm --filter @hpg/web test && pnpm --filter @hpg/web build && pnpm lint` all green.

---

## 2. Warm Living Room redesign — ✅ DONE

Delivered 2026-07-17: the marketing pages, host/join flow, shared UI, and all fourteen game renderers use the warm plum/stage/chalk/flame/punch/honey/orchid token system. Copy-invite-link, segmented room-code input, and inline 18+ confirmation are implemented with component tests. The full 14-test Playwright suite passed, including four multi-user game flows, QR/accessibility contracts, visible keyboard focus, reduced motion, and 320px overflow. Desktop landing/host and 320px join screenshots were visually inspected; key token contrast ratios range from 5.09:1 to 10.75:1.

**Plan:** [2026-07-16-warm-living-room-redesign.md](2026-07-16-warm-living-room-redesign.md).

**Non-negotiable constraints (pinned by the e2e suite — the plan lists them in full):** the Playwright specs assert exact strings, testids, and DOM shapes (e.g. `data-testid="room-code"` is a single 4-letter element, exact button names per game, leaderboard `<li>` format, one `<h2>` per game screen, visible focus outlines, no 320px overflow). Any redesign task that breaks one of these is a failed task.

### How to test
- **Unit:** `pnpm --filter @hpg/web test` (component/logic tests the plan adds for the new UI primitives).
- **Typecheck + lint:** `pnpm -r typecheck` and `pnpm lint`.
- **E2E (the real gate — it pins the visible contract):** `pnpm --filter @hpg/web e2e` (starts both dev servers itself). Must stay green across all 6 specs.
- **Visual / responsive (browser):** drive host + join + one full game in the in-app browser; check light/dark and a 320px viewport for overflow; confirm focus outlines remain visible (a marketing spec asserts computed `outline-style`/`outline-width`).
- **Accessibility:** confirm all animations remain inside `@media (prefers-reduced-motion: no-preference)`.

### Acceptance criteria
- Marketing pages and app screens share one palette (token utilities from `globals.css`).
- Copy-invite-link, segmented code input, and inline 18+ confirm all work and are covered by tests.
- All 6 e2e specs pass; no 320px overflow; focus outlines visible; reduced-motion respected.

---

## 3. Launch hardening — ✅ DONE (committed)

Delivered and committed (commits `4794a53`…`3264173`): malformed-payload validation on every socket event, per-room `hostToken` required by `room:watch`, room cap, per-IP rate limiting on `room:create`/`room:join`, server-side nickname cap, `/health` endpoint, `uncaughtException`/`unhandledRejection` handlers, graceful shutdown, fail-closed CORS in production, web reconnect handling + connection banner + error boundary, and CI typecheck + web-lint + Playwright e2e.

### How to re-verify (regression guard)
- `pnpm --filter @hpg/game-server test` → 55 server tests green.
- Live abuse probe (kept in scratch during QA): a non-host `game:start` is rejected ("Only the host can start a game"); wrong `hostToken` on `room:watch` returns the same "Room not found" as a missing room; malformed `game:input`/`game:start` rejected without crashing; overlong nickname and absurd `rounds` rejected; `curl http://localhost:4000/health` stays `{"status":"ok",...}` throughout.

---

## 4. Full QA pass — 🔵 VERIFY-ONLY (repeat before each release)

A scripted, repeatable manual pass. No code; it re-runs the checks that caught nothing new on 2026-07-17 but must be re-run whenever host/join/game or the engine changes.

### 4a. Normal single-user flow
- Landing renders (hero, how-it-works, 7-game grid, closing CTA); no horizontal scroll at 320px.
- Host screen shows room code, QR, copy-invite-link, and a live player list.
- Join screen: segmented 4-box code input, nickname field, `Join` button.
- **Test:** in-app browser, drive each screen; `read_page` to confirm structure; screenshot the host/TV screen.

### 4b. Multi-user game (≥3 phones + 1 TV)
- Open one host tab + 3 join tabs (each needs a **distinct** `hpg:playerToken` in localStorage — tabs share storage, so set the token then join per-tab before opening the next).
- All players appear on the TV lobby; start a game; play a full round loop; confirm the final leaderboard.
- **Test:** browser tabs as above; confirm prompts stay on the TV while private input stays on phones.

### 4c. Anti-cheat (run the live socket probe)
Re-run the standalone probe (Node + `socket.io-client`, `forceNew` clients) and confirm every line:

| Attack | Expected |
|---|---|
| player (non-host) `game:start` | rejected — "Only the host can start a game" |
| `room:watch` wrong token | rejected — "Room not found" (identical to missing room) |
| `room:watch` correct token | host powers granted |
| truth submitted as a bluff | rejected — "That's the real answer — too easy!" |
| vote for your own bluff | option marked "yours" and disabled |
| malformed `game:input` (null) | rejected, no server crash |
| nickname > 24 chars | rejected |
| absurd `rounds` (1e9) | rejected — "Invalid rounds" |
| nonexistent room / duplicate nickname | rejected cleanly |

Plus the unit guard: `packages/shared/src/games/bluffBattle.test.ts` — "playerView never marks which option is the truth before reveal" and "uses uniform opaque option IDs" must stay green (the truth flag must never reach a phone).

- **Test:** `node <probe>.mjs` against a running `:4000`; then `pnpm --filter @hpg/game-server test` and `pnpm --filter @hpg/shared test`.

### 4d. TV mode
- Host/TV screen displays room code + QR in lobby, the shared game board mid-round, and the leaderboard at the end, all at the large layout.
- **Test:** browser at desktop size; screenshot each phase.

### 4e. Reconnect / resilience
- With a host + a player connected, restart the game server; both screens should show "Reconnecting…", and on restart the host lands on "This room has expired — refresh to start a new one" (in-memory rooms don't survive a restart — expected and now communicated).
- **Test:** manual restart of `@hpg/game-server` dev while two browser tabs are connected.

---

## 5. Pre-deploy ops checklist — 🟡 CONFIGURATION DOCUMENTED; DEPLOYMENT PENDING

Small but launch-blocking. No plan doc needed; do these at deploy time.

The required variables, expected values, and post-deploy curl/device checks are documented in the repository `README.md`. They remain unchecked here until real production domains and deployment-platform access are available.

- ⬜ Set `CORS_ORIGIN=https://<prod-domain>` on the game server (production **fails closed** without it — cross-origin clients are blocked, by design). **Test:** after deploy, a browser on the prod web domain can reach the game server; `curl` from a different origin is blocked.
- ⬜ Set `NEXT_PUBLIC_GAME_SERVER_URL` on the web app to the deployed game-server URL. **Test:** hosting a room on prod actually connects (no console errors, room code appears).
- ⬜ Set `NEXT_PUBLIC_SITE_URL=https://<prod-domain>` (consumed by the SEO plan, item 1) so sitemap/canonical/OG URLs are absolute and correct. **Test:** `curl https://<domain>/sitemap.xml` shows prod URLs, not `localhost`.
- ⬜ (Optional) `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` for analytics + `captureError`. **Test:** an event appears in PostHog after a host+join; with the key unset, nothing is sent (already unit-tested).
- ⬜ Confirm `/health` is reachable behind the deploy platform's health check. **Test:** `curl https://<game-server-domain>/health` → `{"status":"ok","rooms":N}`.

---

## Suggested order

1. Configure item 5 in the production deployment platforms and run its post-deploy checks.
2. Run item 4 once more immediately before flipping production traffic.
3. Submit the verified sitemap in Google Search Console and run external rich-result/social-card validators against the deployed URL.
