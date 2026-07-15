# Launch Hardening Status

Updated: 2026-07-15

Branch: `codex/launch-plan`

This document records the implementation status of
`2026-07-15-launch-hardening.md` at the point the work was committed and pushed.

## Completed

- Task 1: Hardened `room:watch` against malformed payloads and missing acknowledgements.
- Task 2: Hardened `game:start` and bounded requested rounds to 1–50.
- Task 3: Hardened `game:input` against malformed payloads and missing acknowledgements.
- Task 4: Added a 24-character server-side nickname cap.
- Task 5: Added cryptographically random per-room host tokens and live room counting.
- Task 6: Required host tokens for `room:watch`, capped rooms at 500, stored host tokens in
  `sessionStorage`, updated the host screen, and updated browser controllers.
- Task 7: Made production CORS fail closed when `CORS_ORIGIN` is missing.
- Task 8: Added `/health`, fast JSON 404 responses, fatal process handlers, and graceful shutdown.
- Task 9: Added reconnect/re-seat behavior, a reconnecting banner, StrictMode room-create protection,
  PostHog exception capture, and an App Router error boundary.
- Task 10 implementation: fixed the hidden shared-package type error, added package/root typecheck
  scripts, included web lint in the root lint command, and added typecheck to CI.
- Stabilized the Bluff Battle e2e fixture so it derives answers from the canonical 100-prompt pack.
- Task 11: added a dedicated `e2e` GitHub Actions job (installs Chromium, runs the Playwright suite,
  uploads `test-results` on failure) and bumped the Playwright per-test timeout from 30s to 60s after
  reproducing a cold-cache Turbopack dev-server race locally.
- Task 12: widened `.gitignore` to `.env*`, moved `tsx` to `apps/game-server`'s runtime `dependencies`,
  and added baseline security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`,
  `Permissions-Policy`) to every route via `apps/web/next.config.ts`.

## Verified so far

- Full workspace unit/integration tests passed after Tasks 1–9.
- Game-server suite passed with 49 tests after the health and process-lifecycle changes.
- Web unit suite passed with 18 tests.
- Web lint passed.
- Workspace typecheck and root lint/format gate passed after Task 10.
- Full Playwright suite passed: 14 browser tests.
- Manual local checks returned `{"status":"ok","rooms":0}` from `/health`, returned 404 for an
  unknown path, and logged `shutdown_started` plus `shutdown_complete` on SIGINT.
- Task 11 and Task 12 each went through implementer → spec-compliance review → code-quality review;
  both passed both review stages.
- Final full gate re-run after Task 12: `pnpm lint && pnpm typecheck && pnpm test` — all green
  (160 tests across `shared`, `content`, `game-server`, `web`). `apps/web build` confirmed to succeed
  with all four security headers present via `curl -sI` against both `/` and `/join`.

## Pending

- Confirm the `e2e` GitHub Actions job goes green once this branch is pushed/opened as a PR (it has
  only been verified locally so far, per Task 11's own instructions).
- Perform the final two-browser reconnect/restart walkthrough and record the user-facing usage notes.

## All 12 tasks complete

Every task in `2026-07-15-launch-hardening.md` has a landed commit on this branch. Nothing from the
plan remains unimplemented.

## User flow implemented

1. A host opens `/host`; the app creates a room and keeps its host secret in session storage.
2. Players open `/join` or scan the QR code, enter the four-letter code and nickname, and join.
3. The host chooses a game and tone and starts the round.
4. If Wi-Fi drops, both screens display `Reconnecting…`; phones reclaim their existing seat and the
   host reclaims host powers automatically when the room still exists.
5. If the in-memory server restarted and the room expired, the UI explains that the room closed or
   expired instead of freezing on stale state.
