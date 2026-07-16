# Warm Living Room Redesign — Design Spec

**Date:** 2026-07-16
**Status:** Approved direction (visual companion session + terminal), spec pending user review.

## Goal

Give the whole product — marketing pages, host/join flow, and all in-game
screens — one cohesive "Warm Living Room" visual identity, and remove the
worst UX friction in the create/join path. Today the marketing site has a
polished cool-neon look while the app screens (`/host`, `/join`, 14 game
host/play components) are unstyled default Tailwind; they read as two
different products, and the seam sits exactly where a new user clicks
"Host a game".

## Decisions already made (with the user)

1. **Visual direction:** "Warm Living Room" — deep plum base, flame/rose/amber
   accents, softer rounded corners. Chosen over extending the existing cool
   neon marketing theme.
2. **Scope:** everything in one pass — host, join, all 14 game components,
   shared components, error page, **and** the marketing pages re-themed to
   match (no visual seam).
3. **Approach:** Hybrid (approach C) — theme tokens in CSS + five small shared
   UI primitives; no full component-library refactor.
4. **New UX features:** visible "Copy invite link" button on the host lobby
   (same URL the QR already encodes — no new abuse surface; server already
   rate-limits create/join per IP, caps players at 20 and rooms at 500, and
   expires idle rooms), segmented room-code input on join, styled inline 18+
   confirm replacing `window.confirm`.

## Design tokens

`apps/web/src/app/globals.css` is the single source of truth. Old cool
palette (`--midnight/--stage/--iris/--lime/--coral/--cyan`) is replaced:

| Token | Value | Role |
|---|---|---|
| `--plum` | `#1C1420` | page background (was `--midnight`) |
| `--stage` | `#2A1F2B` | raised surfaces: cards, panels, inputs |
| `--chalk` | `#FDF4EC` | primary text (warm off-white) |
| `--muted` | `#C4B3BC` | secondary text — ≈8.5:1 on `--plum`, passes WCAG AA; re-verify during implementation |
| `--flame` | `#F97316` | primary accent, gradient start |
| `--rose` | `#EC4899` | gradient end, secondary accent |
| `--amber` | `#FBBF24` | highlight accent (code tiles, step numbers) |
| `--orchid` | `#C084FC` | fourth accent for game-card variety |
| `--line` | `rgb(253 244 236 / 14%)` | hairline borders |

- Body background keeps the two-radial-glow treatment, re-colored: flame glow
  top-right, rose glow bottom-left, over `--plum`.
- Tokens are exposed through Tailwind v4 `@theme inline` so app screens can
  use utilities (`bg-stage`, `text-muted`, `text-flame`, …) instead of
  hardcoded `slate-*`/`emerald-*`/`indigo-*` classes.
- Focus ring: `--amber` (replaces lime), 3px, offset 4px — unchanged pattern.
- Primary action style: `linear-gradient(90deg, var(--flame), var(--rose))`
  with dark plum text. Hover lifts (existing `translateY` pattern); disabled
  is a flat desaturated surface (NOT `opacity-40` on the gradient); focus
  ring per above.

## Shared primitives — `apps/web/src/components/ui/`

Five components, each pure markup+props (matching the existing "renderer
components are pure" convention), ~20–40 lines, JSDoc on every export:

1. **`Button`** — `variant: 'primary' | 'secondary'`, optional `size: 'lg'`.
   Primary = flame→rose gradient pill; secondary = bordered translucent pill.
   Renders `<button>` (accepts standard button props incl. `disabled`).
2. **`Pill`** — selectable chip for game/tone/vote/answer choices.
   `selected: boolean`; selected = gradient or flame fill, unselected =
   translucent stage chip. Used by host lobby pickers and game vote lists.
3. **`RoomCodePanel`** — host-lobby block: per-character code tiles (large,
   mono, amber/rose tinted characters), QR code, join URL line, and a
   "Copy invite link" button with transient "Copied ✓" state
   (`navigator.clipboard.writeText`, graceful no-op fallback). Keeps
   `data-testid="room-code"` on the code element.
4. **`PlayerChips`** — the lobby player list. Connected = warm filled chip,
   disconnected = muted + line-through (existing semantics). New joiners get
   a subtle pop-in animation, gated behind `prefers-reduced-motion`.
5. **`PromptCard`** — the big centered prompt/question panel used by every
   game's host view (and several play views): stage surface, generous type
   scale for across-the-room TV reading.

## Screen-by-screen

### `/host` (host/page.tsx)
- Lobby recomposed from `RoomCodePanel`, `PlayerChips`, `Pill` rows
  (games + tones), `Button` (start).
- Empty lobby: "Waiting for players…" gets a gentle pulse animation
  (reduced-motion aware) instead of a static line.
- 18+ spicy gate: replace `window.confirm` with an inline styled confirm
  block (message + Confirm/Cancel `Button`s) that appears in place of the
  start button. Same gating logic — spicy + non-mafia only.
- Fatal/creating states re-themed. All socket wiring, token storage, and
  reconnect logic unchanged.

### `/join` (join/page.tsx)
- Segmented 4-box code input: one visually segmented control (either four
  inputs with auto-advance/backspace handling, or a single input rendered as
  tiles — implementer's choice, but paste of a 4-char code and `?code=`
  prefill must both work, and it must be a normal form submit on Enter).
- Nickname field and Join button themed (`Button` primary).
- Waiting-lobby view uses `PlayerChips`; error strings displayed in a themed
  alert style. Reconnect/seat logic unchanged.

### Game components (7 host + 7 play + GameHost/GamePlay dispatchers)
- Mechanical re-skin: swap `slate/emerald/indigo/red` utility classes for
  token utilities and shared primitives (`PromptCard` for prompts, `Pill`
  for vote/choice lists, `Button` for actions).
- No logic, socket, prop, or `data-testid` changes.
- `Leaderboard`, `Countdown`, `ConnectionBanner`, `app/error.tsx` re-themed
  the same way.

### Marketing pages (`/`, `/games/[slug]`)
- `globals.css` marketing classes re-pointed at the new tokens (mostly a
  variable swap; the layout/typography system stays).
- `MarketingGame['accent']` union changes from
  `'#7C3AED' | '#A3E635' | '#FB7185' | '#22D3EE'` to
  `'#F97316' | '#FBBF24' | '#EC4899' | '#C084FC'`, remapped across the seven
  games so adjacent landing-page cards don't repeat accents.
- Room-code marquee on the landing hero re-colored (amber/rose characters,
  flame glow animation).

## Accessibility requirements (hard)

- All text ≥ 4.5:1 contrast on its actual background (muted text included);
  verify token pairs during implementation, not just at spec time.
- All motion (pop-in, pulse, marquee, hovers) gated behind
  `prefers-reduced-motion: no-preference` — existing pattern, keep it.
- Focus-visible ring on every interactive element, including code-input
  segments and the copy-link button.
- Segmented code input remains screen-reader usable (labelled, announces as
  one field or four labelled fields — no unlabeled bare boxes).
- Copy-link "Copied ✓" state announced via `aria-live="polite"`.

## Out of scope

- No server/protocol changes of any kind.
- No new game features, flows, or pages.
- No light mode.
- No changes to reconnect, analytics, or rate-limiting logic.

## Testing & verification

- All existing unit tests (`pnpm -r test`) and Playwright e2e must stay
  green — they assert behavior and test ids, not colors. Do not weaken a
  test to make a restyle pass.
- New unit tests only where new behavior exists: segmented code input
  (typing, paste, prefill, submit) and copy-link (clipboard called with
  `buildJoinUrl` output, copied-state reset).
- Visual verification of every screen via the dev server (host lobby, join
  form, one full game loop, marketing pages) before completion.
