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

## Verified so far

- Full workspace unit/integration tests passed after Tasks 1–9.
- Game-server suite passed with 49 tests after the health and process-lifecycle changes.
- Web unit suite passed with 18 tests.
- Web lint passed.
- Workspace typecheck and root lint/format gate passed after Task 10.
- Full Playwright suite passed: 14 browser tests.
- Manual local checks returned `{"status":"ok","rooms":0}` from `/health`, returned 404 for an
  unknown path, and logged `shutdown_started` plus `shutdown_complete` on SIGINT.

## Pending

- Task 11: add the dedicated Playwright GitHub Actions job and confirm it on GitHub Actions.
- Task 12: widen `.env*` ignore coverage, move `tsx` to runtime dependencies, add security headers,
  and verify the production web build and response headers.
- Run the final full gate: `pnpm lint && pnpm typecheck && pnpm test && pnpm --filter @hpg/web build`
  plus Playwright.
- Perform the final two-browser reconnect/restart walkthrough and record the user-facing usage notes.

## User flow implemented

1. A host opens `/host`; the app creates a room and keeps its host secret in session storage.
2. Players open `/join` or scan the QR code, enter the four-letter code and nickname, and join.
3. The host chooses a game and tone and starts the round.
4. If Wi-Fi drops, both screens display `Reconnecting…`; phones reclaim their existing seat and the
   host reclaims host powers automatically when the room still exists.
5. If the in-memory server restarted and the room expired, the UI explains that the room closed or
   expired instead of freezing on stale state.
