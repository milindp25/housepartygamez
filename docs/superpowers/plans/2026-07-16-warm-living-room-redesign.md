# Warm Living Room Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Re-theme the entire web app (marketing pages, host/join flow, all 14 game components) onto one "Warm Living Room" visual identity, and ship three UX upgrades: a Copy-invite-link button, a segmented room-code input, and an inline 18+ confirm.

**Architecture:** New palette lives as CSS custom properties in `globals.css`, exposed to Tailwind v4 via `@theme inline` so app screens use token utilities (`bg-stage`, `text-mist`, …). Six small pure UI primitives in `apps/web/src/components/ui/` absorb repetition; game components get a mechanical class re-skin with zero logic/socket/test-id changes. Spec: `docs/superpowers/specs/2026-07-16-warm-theme-redesign-design.md`.

**Tech Stack:** Next.js 16 (app router), Tailwind v4, React 19, vitest 3 (+ jsdom + @testing-library/react added here), Playwright e2e, pnpm workspaces.

---

## Non-negotiable constraints (from e2e suite — read before every task)

The Playwright suite pins these; breaking any of them is a task failure:

- Join page: an element matching `getByPlaceholder('ROOM CODE')` that supports `.fill(code)` and `toHaveValue(code)` after `?code=` prefill; `getByPlaceholder('Your nickname')`; a button named exactly `Join`.
- Host page: `data-testid="room-code"` whose `innerText()` is exactly the 4-letter code (single element — do NOT split the code into per-character DOM nodes on the host screen); text `Scan with your phone to join`; link named `Open join page for this room`; img named `QR code to join this room`; buttons named exactly by game (`Bluff Battle`, …) and `Start <Game Name>`.
- Player nicknames on host lobby must match `getByText(name, { exact: true })` — chip elements contain the nickname text and nothing else.
- Leaderboard: `<li>` per row containing `{score} {unit}` (e.g. `3 pts`).
- Game screens keep all visible strings exactly (`Bluff locked in 😈`, `Pick the real answer`, `Real answer: …`, `✓ truth`, `Fooled: …`, `Submit bluff`, `Next`, `Back to lobby`, `Waiting for players…`, etc.) and exactly one `<h2>` per game screen (a spec reads `locator('h2').innerText()`).
- Focus outlines must remain visible (marketing spec asserts computed `outline-style`/`outline-width`); all animations stay inside `@media (prefers-reduced-motion: no-preference)`; landing page must not overflow a 320px viewport.

**Test commands:**
- Web unit: `pnpm --filter @hpg/web test`
- Typecheck: `pnpm -r typecheck`
- Lint + format check: `pnpm lint` (run `pnpm format` first if it complains)
- E2E (starts both dev servers itself): `pnpm --filter @hpg/web e2e` (single spec: `pnpm --filter @hpg/web e2e host-qr`)

## Token cheat-sheet (used everywhere below)

| Token | Value | Utility examples |
|---|---|---|
| `plum` | `#1C1420` | page bg (via body), `text-plum` on gradient buttons |
| `stage` | `#2A1F2B` | `bg-stage` panels/rows/inputs |
| `chalk` | `#FDF4EC` | `text-chalk` primary text |
| `mist` | `#C4B3BC` | `text-mist` secondary text (≈8.5:1 on plum) |
| `flame` | `#F97316` | `from-flame` gradient start |
| `punch` | `#EC4899` | `to-punch` gradient end, "b-side"/danger-ish accents |
| `honey` | `#FBBF24` | `text-honey` highlights, selection rings, positive reveals |
| `orchid` | `#C084FC` | "a-side"/info accents |
| `line` | `rgb(253 244 236 / 14%)` | `border-line` hairlines |

Canonical class mapping (applies in Tasks 8–9; exhaustive for those files):

| Old | New |
|---|---|
| `text-white` | `text-chalk` |
| `text-slate-300` | `text-chalk/80` |
| `text-slate-400` | `text-mist` |
| `text-slate-500` | `text-mist/70` |
| `text-slate-600` | `text-mist/50` |
| `bg-slate-800` | `border border-line bg-stage` |
| `bg-slate-900` | `border border-line bg-plum/60` |
| `bg-indigo-700` (option/quote panels) | `border border-orchid/50 bg-orchid/15` |
| `bg-rose-700` / `bg-rose-800` | `border border-punch/50 bg-punch/15` |
| `bg-emerald-700` / `bg-emerald-800` (truth/caught panels) | `border border-honey/60 bg-honey/15 text-honey` |
| `bg-amber-600` (eliminated banner) | `border border-honey/60 bg-honey/15 text-honey` |
| `ring-white` / `ring-amber-400` | `ring-honey` |
| `ring-indigo-400` | `ring-orchid` |
| `hover:bg-slate-700` | `hover:bg-chalk/10` |
| `text-amber-200` / `text-amber-300` | `text-honey` |
| `text-indigo-200` / `text-indigo-300` / `text-sky-300` | `text-orchid` |
| `text-rose-300` | `text-punch` |
| `text-emerald-300` | `text-honey` |
| any `bg-emerald-600`/`bg-indigo-600`/`bg-amber-500`/`bg-indigo-500` **action `<button>`** | replace the whole element with the `Button` primitive (Task 3) |
| `bg-slate-950` on `<main>` | delete (body background shows through) |
| `text-red-400` errors | keep as-is (semantic error color stays red) |

---

## File Structure

| File | Change |
|---|---|
| `apps/web/src/app/globals.css` | Modify — new tokens, body glows, focus ring, marketing color swap, new keyframes |
| `apps/web/src/lib/games.ts` | Modify — warm accent union + per-game values |
| `apps/web/vitest.config.ts` | Create — React plugin for component tests |
| `apps/web/package.json` | Modify — add jsdom, @testing-library/react, @vitejs/plugin-react |
| `apps/web/src/lib/room-code.ts` (+ `.test.ts`) | Create — `normalizeRoomCode` |
| `apps/web/src/components/ui/Button.tsx` (+ `.test.tsx`) | Create |
| `apps/web/src/components/ui/Pill.tsx` (+ `.test.tsx`) | Create |
| `apps/web/src/components/ui/CodeInput.tsx` (+ `.test.tsx`) | Create |
| `apps/web/src/components/ui/CopyLinkButton.tsx` (+ `.test.tsx`) | Create |
| `apps/web/src/components/ui/RoomCodePanel.tsx` | Create |
| `apps/web/src/components/ui/PlayerChips.tsx` | Create |
| `apps/web/src/components/ui/PromptCard.tsx` | Create |
| `apps/web/src/components/{ConnectionBanner,Countdown,Leaderboard}.tsx`, `apps/web/src/app/error.tsx` | Modify — re-theme |
| `apps/web/src/app/host/page.tsx`, `apps/web/src/app/join/page.tsx` | Modify — recompose |
| `apps/web/src/components/host/*.tsx` (7), `apps/web/src/components/play/*.tsx` (7) | Modify — mechanical re-skin |

---

### Task 1: Warm token foundation + marketing re-theme

The marketing CSS already routes every color through `:root` variables, so this task is variable renames/revalues plus a handful of literal `rgb(...)` glow swaps. After this task the marketing pages are fully warm-themed.

**Files:**
- Modify: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/lib/games.ts`

- [x] **Step 1: Replace the `:root` and `@theme` blocks** at the top of `globals.css` with:

```css
:root {
  --plum: #1c1420;
  --stage: #2a1f2b;
  --chalk: #fdf4ec;
  --flame: #f97316;
  --punch: #ec4899;
  --honey: #fbbf24;
  --orchid: #c084fc;
  --background: var(--plum);
  --foreground: var(--chalk);
  --mist: #c4b3bc;
  --line: rgb(253 244 236 / 14%);
  color-scheme: dark;
}

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-plum: var(--plum);
  --color-stage: var(--stage);
  --color-chalk: var(--chalk);
  --color-mist: var(--mist);
  --color-flame: var(--flame);
  --color-punch: var(--punch);
  --color-honey: var(--honey);
  --color-orchid: var(--orchid);
  --color-line: var(--line);
  --font-sans: var(--font-geist-sans);
  --font-mono: var(--font-geist-mono);
}
```

- [x] **Step 2: Global variable renames** across the rest of `globals.css` (exact find/replace, all occurrences):
  - `var(--midnight)` → `var(--plum)`
  - `var(--iris)` → `var(--flame)`
  - `var(--lime)` → `var(--honey)`
  - `var(--coral)` → `var(--punch)`
  - `var(--cyan)` → `var(--orchid)`
  - `var(--muted)` → `var(--mist)`

- [x] **Step 3: Literal color swaps** (exact find/replace, all occurrences):
  - `248 250 252` → `253 244 236` (old chalk in rgb() borders/gradients)
  - `124 58 237` → `249 115 22` (iris glows → flame)
  - `34 211 238` → `192 132 252` (cyan glows → orchid)
  - `163 230 53` → `251 191 36` (lime borders/gradients → honey)
  - In `body`, the second radial becomes a punch glow: `rgb(192 132 252 / 10%)` → `rgb(236 72 153 / 10%)` (only the body rule — the marquee tile glow stays orchid)

- [x] **Step 4: Primary button becomes the flame→punch gradient with dark text.** In `.button-primary` replace `background: var(--flame);` + `color: var(--chalk);` with:

```css
  background: linear-gradient(90deg, var(--flame), var(--punch));
  box-shadow: 0 0 2rem rgb(236 72 153 / 25%);
  color: var(--plum);
```

(Delete the old `box-shadow` line it replaces.) `.skip-link` already uses honey bg + plum text after the renames — leave it.

- [x] **Step 5: Add app-screen keyframes** inside the existing `@media (prefers-reduced-motion: no-preference)` block (so reduced-motion users get none of it):

```css
  .player-chip {
    animation: chip-pop 240ms ease;
  }

  .waiting-pulse {
    animation: waiting-pulse 2.4s ease-in-out infinite;
  }

  @keyframes chip-pop {
    from {
      transform: scale(0.85);
      opacity: 0;
    }

    to {
      transform: scale(1);
      opacity: 1;
    }
  }

  @keyframes waiting-pulse {
    0%,
    100% {
      opacity: 0.5;
    }

    50% {
      opacity: 1;
    }
  }
```

- [x] **Step 6: Remap game accents in `games.ts`.** Change the union and the seven values:

```ts
  accent: '#F97316' | '#FBBF24' | '#EC4899' | '#C084FC'
```

Per game: would-you-rather `#F97316`, most-likely-to `#FBBF24`, never-have-i-ever `#EC4899`, who-said-that `#C084FC`, imposter `#F97316`, bluff-battle `#FBBF24`, mafia `#EC4899`. (2-column landing grid: no accent repeats horizontally or vertically.)

- [x] **Step 7: Verify**

Run: `pnpm --filter @hpg/web test && pnpm -r typecheck && pnpm lint`
Expected: all pass (`games.test.ts` doesn't assert accents).
Then start the dev servers and eyeball `/` and `/games/would-you-rather` — warm palette, no cool blues/limes left, focus ring is honey.

- [x] **Step 8: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/lib/games.ts
git commit -m "feat(web): warm living room palette tokens and marketing re-theme"
```

---

### Task 2: Component-test tooling + `normalizeRoomCode`

Vitest currently runs node-env `.ts` tests only. Component tests (Tasks 3–5) need jsdom + a JSX transform.

**Files:**
- Modify: `apps/web/package.json` (via pnpm add)
- Create: `apps/web/vitest.config.ts`
- Create: `apps/web/src/lib/room-code.ts`, `apps/web/src/lib/room-code.test.ts`

- [x] **Step 1: Add dev deps**

Run: `pnpm --filter @hpg/web add -D jsdom @testing-library/react @vitejs/plugin-react`

- [x] **Step 2: Create `apps/web/vitest.config.ts`**

```ts
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Vitest config for @hpg/web. The React plugin provides the JSX transform
 * for component tests; jsdom is opted into per-file with a
 * `@vitest-environment jsdom` comment so pure lib tests stay in node.
 */
export default defineConfig({
  plugins: [react()],
})
```

- [x] **Step 3: Write the failing test** — `apps/web/src/lib/room-code.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { normalizeRoomCode } from './room-code'

describe('normalizeRoomCode', () => {
  it('uppercases lowercase input', () => {
    expect(normalizeRoomCode('part')).toBe('PART')
  })
  it('strips non-letters (paste of a messy code)', () => {
    expect(normalizeRoomCode(' pa-rt! ')).toBe('PART')
  })
  it('caps at four characters', () => {
    expect(normalizeRoomCode('PARTYTIME')).toBe('PART')
  })
  it('passes through partial and empty input', () => {
    expect(normalizeRoomCode('PA')).toBe('PA')
    expect(normalizeRoomCode('')).toBe('')
  })
})
```

- [x] **Step 4: Run to verify failure** — `pnpm --filter @hpg/web test` → FAIL (module not found).

- [x] **Step 5: Implement `apps/web/src/lib/room-code.ts`**

```ts
/**
 * Uppercase a raw room-code string and strip it to at most four A–Z
 * characters. Applied to every keystroke and paste in the join-code input
 * so the field can never hold something the server would reject on shape.
 */
export function normalizeRoomCode(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z]/g, '')
    .slice(0, 4)
}
```

- [x] **Step 6: Run tests** — `pnpm --filter @hpg/web test` → PASS (including all pre-existing lib tests, proving the new config didn't break node-env tests).

- [x] **Step 7: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml apps/web/vitest.config.ts apps/web/src/lib/room-code.ts apps/web/src/lib/room-code.test.ts
git commit -m "test(web): component-test tooling and room-code normalizer"
```

---

### Task 3: `Button` and `Pill` primitives

**Files:**
- Create: `apps/web/src/components/ui/Button.tsx`, `Button.test.tsx`, `Pill.tsx`, `Pill.test.tsx`

- [x] **Step 1: Write failing tests** — `apps/web/src/components/ui/Button.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'

describe('Button', () => {
  it('renders an accessible button and forwards clicks', () => {
    const onClick = vi.fn()
    render(<Button onClick={onClick}>Start game</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('does not fire clicks when disabled', () => {
    const onClick = vi.fn()
    render(
      <Button onClick={onClick} disabled>
        Start game
      </Button>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Start game' }))
    expect(onClick).not.toHaveBeenCalled()
  })
})
```

And `apps/web/src/components/ui/Pill.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Pill } from './Pill'

describe('Pill', () => {
  it('renders a button with its label and forwards clicks', () => {
    const onClick = vi.fn()
    render(<Pill onClick={onClick}>Mafia</Pill>)
    fireEvent.click(screen.getByRole('button', { name: 'Mafia' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('marks the selected state for assistive tech', () => {
    render(<Pill selected>Spicy</Pill>)
    expect(screen.getByRole('button', { name: 'Spicy' }).getAttribute('aria-pressed')).toBe('true')
  })
})
```

- [x] **Step 2: Run to verify failure** — `pnpm --filter @hpg/web test` → FAIL (modules not found).

- [x] **Step 3: Implement.** `apps/web/src/components/ui/Button.tsx`:

```tsx
import type { ButtonHTMLAttributes } from 'react'

const VARIANTS = {
  primary:
    'bg-gradient-to-r from-flame to-punch text-plum shadow-[0_0_1.5rem_rgb(236_72_153/30%)] hover:brightness-110 disabled:from-stage disabled:to-stage disabled:text-mist disabled:shadow-none',
  secondary: 'border border-chalk/25 bg-chalk/5 text-chalk hover:bg-chalk/10',
} as const

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof VARIANTS
  size?: 'md' | 'lg'
}

/**
 * Themed pill-shaped action button. `primary` is the flame→punch gradient
 * with dark plum text; `secondary` is a translucent bordered pill. Extra
 * classes may be appended via `className`; all native button props pass
 * through.
 */
export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  const sizing = size === 'lg' ? 'px-8 py-4 text-xl' : 'px-6 py-3 text-lg'
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded-full font-bold transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${sizing} ${className}`}
    />
  )
}
```

`apps/web/src/components/ui/Pill.tsx`:

```tsx
import type { ButtonHTMLAttributes } from 'react'

export interface PillProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
}

/**
 * Selectable chip used for game, tone, and answer choices. Selected pills
 * fill with the flame→punch gradient; unselected pills are translucent
 * stage chips. Exposes `aria-pressed` so the state is not color-only.
 */
export function Pill({ selected = false, className = '', ...props }: PillProps) {
  return (
    <button
      {...props}
      aria-pressed={selected}
      className={`rounded-full px-4 py-2 transition ${
        selected
          ? 'bg-gradient-to-r from-flame to-punch font-bold text-plum'
          : 'border border-line bg-chalk/5 text-chalk hover:bg-chalk/10'
      } ${className}`}
    />
  )
}
```

- [x] **Step 4: Run tests** — `pnpm --filter @hpg/web test` → PASS.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/components/ui
git commit -m "feat(web): Button and Pill ui primitives"
```

---

### Task 4: `CodeInput`, `CopyLinkButton`, `RoomCodePanel`, `PlayerChips`, `PromptCard`

`CodeInput` is a single invisible `<input>` (placeholder `ROOM CODE` — an e2e contract) stretched over four visual tiles: paste, autofill, Enter-to-submit, and `.fill()` all keep working because it IS a normal input.

**Files:**
- Create: `apps/web/src/components/ui/CodeInput.tsx`, `CodeInput.test.tsx`, `CopyLinkButton.tsx`, `CopyLinkButton.test.tsx`, `RoomCodePanel.tsx`, `PlayerChips.tsx`, `PromptCard.tsx`

- [x] **Step 1: Write failing tests** — `apps/web/src/components/ui/CodeInput.test.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { CodeInput } from './CodeInput'

function Harness({ initial = '' }: { initial?: string }) {
  const [code, setCode] = useState(initial)
  return <CodeInput value={code} onChange={setCode} />
}

function input(): HTMLInputElement {
  return screen.getByPlaceholderText('ROOM CODE') as HTMLInputElement
}

describe('CodeInput', () => {
  it('normalizes typed and pasted text to four uppercase letters', () => {
    render(<Harness />)
    fireEvent.change(input(), { target: { value: ' pa-rt99y ' } })
    expect(input().value).toBe('PART')
  })

  it('renders a prefilled value into the tiles', () => {
    const { container } = render(<Harness initial="WXYZ" />)
    const tiles = [...container.querySelectorAll('[data-tile]')].map((t) => t.textContent)
    expect(tiles).toEqual(['W', 'X', 'Y', 'Z'])
  })

  it('leaves remaining tiles empty for partial codes', () => {
    const { container } = render(<Harness initial="PA" />)
    const tiles = [...container.querySelectorAll('[data-tile]')].map((t) => t.textContent)
    expect(tiles).toEqual(['P', 'A', '', ''])
  })
})
```

And `apps/web/src/components/ui/CopyLinkButton.test.tsx`:

```tsx
// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { CopyLinkButton } from './CopyLinkButton'

const url = 'http://localhost:3000/join?code=PART'

afterEach(() => {
  vi.useRealTimers()
})

describe('CopyLinkButton', () => {
  it('copies the join url and confirms, then resets after 2s', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })

    render(<CopyLinkButton url={url} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy invite link' }))
    await act(async () => {}) // flush the clipboard promise
    expect(writeText).toHaveBeenCalledWith(url)
    expect(screen.getByRole('button', { name: 'Copied ✓' })).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(screen.getByRole('button', { name: 'Copy invite link' })).toBeTruthy()
  })

  it('stays quiet when the clipboard is unavailable', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'))
    Object.assign(navigator, { clipboard: { writeText } })

    render(<CopyLinkButton url={url} />)
    fireEvent.click(screen.getByRole('button', { name: 'Copy invite link' }))
    await act(async () => {})
    expect(screen.getByRole('button', { name: 'Copy invite link' })).toBeTruthy()
  })
})
```

- [x] **Step 2: Run to verify failure** — `pnpm --filter @hpg/web test` → FAIL.

- [x] **Step 3: Implement.** `apps/web/src/components/ui/CodeInput.tsx`:

```tsx
'use client'
import { useState } from 'react'
import { normalizeRoomCode } from '@/lib/room-code'

const TILE_TINTS = ['text-chalk', 'text-honey', 'text-chalk', 'text-punch'] as const

/**
 * Four-tile room-code entry backed by a single invisible `<input>` layered
 * over the tiles, so paste, autofill, Enter-to-submit, and `?code=` prefill
 * behave exactly like a plain text field while the tiles carry the visuals.
 * Every change is passed through {@link normalizeRoomCode}.
 */
export function CodeInput({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [focused, setFocused] = useState(false)
  const activeIndex = Math.min(value.length, 3)
  return (
    <div className="relative">
      <input
        value={value}
        onChange={(e) => onChange(normalizeRoomCode(e.target.value))}
        placeholder="ROOM CODE"
        maxLength={4}
        autoCapitalize="characters"
        autoComplete="one-time-code"
        aria-label="Room code"
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        className="absolute inset-0 z-10 h-full w-full cursor-text text-3xl opacity-0"
      />
      <div aria-hidden="true" className="grid grid-cols-4 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            data-tile
            className={`grid h-16 place-items-center rounded-xl border bg-stage font-mono text-3xl font-bold ${TILE_TINTS[i]} ${
              focused && i === activeIndex ? 'border-flame' : 'border-line'
            }`}
          >
            {value[i] ?? ''}
          </span>
        ))}
      </div>
    </div>
  )
}
```

`apps/web/src/components/ui/CopyLinkButton.tsx`:

```tsx
'use client'
import { useEffect, useState } from 'react'
import { Button } from './Button'

/**
 * Copies the room's join URL to the clipboard with a transient "Copied ✓"
 * confirmation (announced politely to screen readers). If the clipboard is
 * unavailable (permissions, insecure context) it fails silently — the QR
 * code and room code on screen remain the join path.
 */
export function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) return
    const id = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(id)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Clipboard unavailable — QR and visible code still work.
    }
  }

  return (
    <>
      <Button variant="secondary" onClick={copy}>
        {copied ? 'Copied ✓' : 'Copy invite link'}
      </Button>
      <span aria-live="polite" className="sr-only">
        {copied ? 'Invite link copied' : ''}
      </span>
    </>
  )
}
```

`apps/web/src/components/ui/RoomCodePanel.tsx` (markup lifted from the current host lobby; code stays ONE element for the e2e `innerText` contract):

```tsx
'use client'
import { QRCodeSVG } from 'qrcode.react'
import { CopyLinkButton } from './CopyLinkButton'

/**
 * The host lobby's join block: giant gradient room code, QR code, join URL
 * host, and a copy-invite-link button. The code stays a single element so
 * `data-testid="room-code"` reads as exactly four letters.
 */
export function RoomCodePanel({
  code,
  joinUrl,
  joinHost,
}: {
  code: string
  joinUrl: string
  joinHost: string
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 sm:flex-row sm:gap-10">
      <div className="min-w-0">
        <p className="text-xl text-mist">Join at {joinHost}/join with code</p>
        <p
          className="mt-3 bg-gradient-to-r from-honey via-flame to-punch bg-clip-text font-mono text-6xl font-bold tracking-[0.2em] text-transparent sm:text-8xl sm:tracking-[0.3em]"
          data-testid="room-code"
        >
          {code}
        </p>
        <div className="mt-4 flex justify-center">
          <CopyLinkButton url={joinUrl} />
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-center gap-2">
        <a
          href={joinUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Open join page for this room"
          className="overflow-hidden rounded-2xl border border-line"
        >
          <QRCodeSVG
            value={joinUrl}
            size={160}
            bgColor="#FDF4EC"
            fgColor="#1C1420"
            marginSize={4}
            level="M"
            title="QR code to join this room"
            role="img"
            aria-label="QR code to join this room"
          />
        </a>
        <p className="text-sm text-chalk/80">Scan with your phone to join</p>
      </div>
    </div>
  )
}
```

`apps/web/src/components/ui/PlayerChips.tsx` (chip text is the nickname ONLY — e2e uses exact text match):

```tsx
/**
 * Lobby player list. Connected players get a warm chip with a pop-in
 * animation (reduced-motion gated in globals.css); disconnected players
 * stay muted with a line-through, matching the pre-redesign semantics.
 */
export function PlayerChips({
  players,
}: {
  players: Array<{ id: string; nickname: string; connected: boolean }>
}) {
  return (
    <ul className="flex flex-wrap justify-center gap-3">
      {players.map((p) => (
        <li
          key={p.id}
          className={`player-chip rounded-full px-4 py-2 text-lg ${
            p.connected
              ? 'border border-honey/40 bg-stage text-chalk'
              : 'border border-line bg-stage/50 text-mist line-through'
          }`}
        >
          {p.nickname}
        </li>
      ))}
    </ul>
  )
}
```

`apps/web/src/components/ui/PromptCard.tsx`:

```tsx
import type { ReactNode } from 'react'

/**
 * Round-meta line plus the big prompt heading shared by game screens.
 * Renders exactly one `<h2>` whose text content is the prompt alone —
 * several e2e specs read the screen's single h2. `size` tunes the type
 * scale for TV vs phone; `className` may add non-conflicting extras
 * (e.g. max-widths).
 */
export function PromptCard({
  meta,
  size = 'tv',
  className = '',
  children,
}: {
  meta?: ReactNode
  size?: 'tv' | 'phone'
  className?: string
  children: ReactNode
}) {
  return (
    <header className="space-y-3">
      {meta !== undefined && <p className="text-mist">{meta}</p>}
      <h2 className={`${size === 'tv' ? 'text-4xl' : 'text-xl'} font-bold text-chalk ${className}`}>
        {children}
      </h2>
    </header>
  )
}
```

- [x] **Step 4: Run tests** — `pnpm --filter @hpg/web test` → PASS.

- [x] **Step 5: Commit**

```bash
git add apps/web/src/components/ui
git commit -m "feat(web): code input, copy link, room panel, chips, prompt primitives"
```

---

### Task 5: Re-theme shared bits (ConnectionBanner, Countdown, Leaderboard, error page)

Pure class changes + one Button adoption; all visible strings and DOM roles unchanged.

**Files:**
- Modify: `apps/web/src/components/ConnectionBanner.tsx`, `Countdown.tsx`, `Leaderboard.tsx`, `apps/web/src/app/error.tsx`

- [x] **Step 1: ConnectionBanner** — replace the `<p>` with:

```tsx
    <p
      role="status"
      className="mb-4 rounded-full border border-honey/40 bg-honey/10 px-4 py-2 text-center text-honey"
    >
      Reconnecting…
    </p>
```

- [x] **Step 2: Countdown** — final `<span>` className becomes:

```tsx
  return (
    <span className="rounded-full border border-line bg-stage px-3 py-1 font-mono text-lg text-honey">
      {left}s
    </span>
  )
```

- [x] **Step 3: Leaderboard** — `<li>` becomes (leader row gets a honey rim; `{score} {unit}` text preserved):

```tsx
        <li
          key={r.playerId}
          className={`flex justify-between rounded-xl border px-4 py-3 text-lg ${
            i === 0 ? 'border-honey/60 bg-honey/10' : 'border-line bg-stage'
          }`}
        >
          <span>
            {i === 0 ? '👑 ' : `${i + 1}. `}
            {r.nickname}
          </span>
          <span className="text-mist">
            {r.score} {unit}
          </span>
        </li>
```

- [x] **Step 4: error.tsx** — import Button and re-theme:

```tsx
import { Button } from '@/components/ui/Button'
```

```tsx
    <main className="grid min-h-screen place-items-center p-6 text-center text-chalk">
      <div>
        <h1 className="mb-2 text-2xl font-bold">Something went wrong</h1>
        <p className="mb-6 text-mist">
          The game screen hit an error. Trying again usually fixes it.
        </p>
        <Button onClick={reset}>Try again</Button>
      </div>
    </main>
```

- [x] **Step 5: Verify + commit**

Run: `pnpm --filter @hpg/web test && pnpm -r typecheck`
```bash
git add apps/web/src/components apps/web/src/app/error.tsx
git commit -m "feat(web): re-theme connection banner, countdown, leaderboard, error page"
```

---### Task 6: Host page recomposition

All socket/token/reconnect logic is untouched; only render code and the spicy-confirm flow change. `window.confirm` disappears.

**Files:**
- Modify: `apps/web/src/app/host/page.tsx`

- [x] **Step 1: Update imports** — remove `import { QRCodeSVG } from 'qrcode.react'`, add:

```tsx
import { Button } from '@/components/ui/Button'
import { Pill } from '@/components/ui/Pill'
import { PlayerChips } from '@/components/ui/PlayerChips'
import { RoomCodePanel } from '@/components/ui/RoomCodePanel'
```

- [x] **Step 2: Replace the confirm flow.** Add state `const [confirmSpicy, setConfirmSpicy] = useState(false)` beside the other useState calls, and replace `startGame` with:

```tsx
  const needsSpicyConfirm = gameId !== 'mafia' && tone === 'spicy'

  /** First click on Start arms the inline 18+ confirm for spicy packs. */
  function startGame() {
    if (needsSpicyConfirm && !confirmSpicy) {
      setConfirmSpicy(true)
      return
    }
    doStart()
  }

  /** Emit game:start; the server enforces game/pack validity. */
  function doStart() {
    setConfirmSpicy(false)
    setError(null)
    getSocket().emit('game:start', { gameId, tone }, (res) => {
      if (!res.ok) {
        setError(res.error)
        return
      }
      track('game_started', { gameId, tone })
    })
  }
```

- [x] **Step 3: Re-theme the three non-lobby returns** (drop `bg-slate-950`, `text-white` → `text-chalk`):
  - fatal: `<main className="grid min-h-screen place-items-center p-8 text-chalk">` (keep the `text-red-400` message, add `role="alert"` to it)
  - creating: `<main className="grid min-h-screen place-items-center text-mist">Creating room…</main>`
  - game phase: `<main className="grid min-h-screen place-items-center p-8 text-chalk">`

- [x] **Step 4: Replace the lobby return** with:

```tsx
  return (
    <main className="grid min-h-screen place-items-center p-4 text-chalk sm:p-8">
      <div className="w-full max-w-5xl space-y-6 text-center">
        <ConnectionBanner connected={connected} />
        <RoomCodePanel code={msg.code} joinUrl={joinUrl} joinHost={window.location.host} />
        <PlayerChips players={msg.players} />
        {msg.players.length === 0 ? (
          <p className="waiting-pulse text-mist">Waiting for players…</p>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-center gap-2">
              {GAMES.map((g) => (
                <Pill
                  key={g.id}
                  selected={gameId === g.id}
                  onClick={() => {
                    setGameId(g.id)
                    setConfirmSpicy(false)
                  }}
                >
                  {g.name}
                  {g.note && <span className="ml-2 text-xs opacity-70">{g.note}</span>}
                </Pill>
              ))}
            </div>
            {gameId !== 'mafia' && (
              <div className="flex justify-center gap-2">
                {TONES.map((t) => (
                  <Pill
                    key={t}
                    selected={tone === t}
                    className="capitalize"
                    onClick={() => {
                      setTone(t)
                      setConfirmSpicy(false)
                    }}
                  >
                    {t}
                    {t === 'spicy' && ' 🔞'}
                  </Pill>
                ))}
              </div>
            )}
            {confirmSpicy ? (
              <section className="mx-auto max-w-md space-y-3 rounded-2xl border border-punch/50 bg-punch/10 p-5">
                <p className="text-lg font-bold">Spicy pack is 18+.</p>
                <p className="text-mist">Make sure everyone in the room is an adult.</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button onClick={doStart}>Everyone&apos;s 18+ — start</Button>
                  <Button variant="secondary" onClick={() => setConfirmSpicy(false)}>
                    Cancel
                  </Button>
                </div>
              </section>
            ) : (
              <Button size="lg" onClick={startGame}>
                Start {GAMES.find((g) => g.id === gameId)?.name}
              </Button>
            )}
            {error && (
              <p role="alert" className="text-red-400">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    </main>
  )
```

- [x] **Step 5: Verify**

Run: `pnpm --filter @hpg/web test && pnpm -r typecheck && pnpm --filter @hpg/web e2e host-qr marketing`
Expected: PASS. Then visually check `/host` on the dev server: warm lobby, copy-link button works (click → "Copied ✓" → paste in a new tab lands on prefilled join), spicy confirm appears inline for a spicy tone and is cancellable.

- [x] **Step 6: Commit**

```bash
git add apps/web/src/app/host/page.tsx
git commit -m "feat(web): warm host lobby with copy link and inline 18+ confirm"
```

---

### Task 7: Join page recomposition

**Files:**
- Modify: `apps/web/src/app/join/page.tsx`

- [x] **Step 1: Update imports** — add:

```tsx
import { normalizeRoomCode } from '@/lib/room-code'
import { Button } from '@/components/ui/Button'
import { CodeInput } from '@/components/ui/CodeInput'
import { PlayerChips } from '@/components/ui/PlayerChips'
```

- [x] **Step 2: Normalize the prefill** — change the code state initializer to:

```tsx
  const [code, setCode] = useState(() => normalizeRoomCode(params.get('code') ?? ''))
```

(`join()` keeps `code.trim()` — harmless on normalized input.)

- [x] **Step 3: Re-theme the in-room returns:**
  - game phase main: `<main className="min-h-screen p-6 text-chalk">`
  - lobby return:

```tsx
    return (
      <main className="min-h-screen p-6 text-chalk">
        <ConnectionBanner connected={connected} />
        <h1 className="mb-1 text-2xl font-bold">Room {view.code}</h1>
        <p className="mb-4 text-mist">Waiting for the host to start…</p>
        <PlayerChips players={view.players} />
      </main>
    )
```

- [x] **Step 4: Replace the form return** with:

```tsx
  return (
    <main className="grid min-h-screen place-items-center p-6 text-chalk">
      <form onSubmit={join} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-center text-3xl font-bold">Join a game</h1>
        <CodeInput value={code} onChange={setCode} />
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Your nickname"
          maxLength={20}
          aria-label="Your nickname"
          className="rounded-xl border border-line bg-stage p-4 text-lg text-chalk placeholder:text-mist"
        />
        {error && (
          <p role="alert" className="text-center text-red-400">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={code.length !== 4 || !nickname.trim()}>
          Join
        </Button>
      </form>
    </main>
  )
```

- [x] **Step 5: Verify**

Run: `pnpm --filter @hpg/web test && pnpm -r typecheck && pnpm --filter @hpg/web e2e host-qr would-you-rather`
Expected: PASS (would-you-rather drives the full join → lobby → game loop through the new form). Visually check `/join` on a phone-sized viewport: tiles fill as you type, paste of a lowercase code works, Enter submits.

- [x] **Step 6: Commit**

```bash
git add apps/web/src/app/join/page.tsx
git commit -m "feat(web): warm join flow with segmented code input"
```

---

### Task 8: Re-skin the seven host (TV) components

Mechanical pass. For every file: apply the **canonical class mapping table** (top of this plan) to each listed occurrence, convert action buttons to `Button`, and adopt `PromptCard` exactly where shown. Change nothing else — no logic, props, strings, or element order. Each file needs `import { Button } from '../ui/Button'` and (where used) `import { PromptCard } from '../ui/PromptCard'`.

**Files:** Modify all of `apps/web/src/components/host/{WyrHost,MltHost,NhieHost,WstHost,ImposterHost,BluffHost,MafiaHost}.tsx`

- [x] **Step 1: Button conversions (all files).** Every `<button onClick={onEnd|onAdvance} className="rounded-lg bg-emerald-600 px-6 py-3 text-lg font-bold">LABEL</button>` becomes `<Button onClick={onEnd|onAdvance}>LABEL</Button>` (labels: `Back to lobby`, `Next`, `Start clues`, `Next speaker`, `Next round`). In MafiaHost the three big buttons become `<Button size="lg" onClick={onAdvance}>Start the vote</Button>`, `<Button size="lg" onClick={onAdvance}>Nightfall</Button>`, `<Button size="lg" onClick={onEnd}>Back to lobby</Button>` (their explicit focus-visible classes are dropped — the global honey ring applies).

- [x] **Step 2: PromptCard adoptions.** Replace each `<p className="text-slate-400">META</p>` + adjacent `<h2 ...>PROMPT</h2>` pair with `<PromptCard meta={<>META</>}>PROMPT</PromptCard>`, preserving the meta JSX (round counters, `<Countdown …/>`) verbatim:
  - **WyrHost**: main return (`Would you rather…`).
  - **MltHost**: main return (`Who is most likely to {view.prompt.text}?`).
  - **NhieHost**: main return (`Never have I ever {view.prompt.text}`).
  - **WstHost**: `answer` phase (meta `Everyone answering privately <Countdown …/>`, prompt `{view.prompt.text}`) and `guess` phase (meta `Answer {view.turn}/{view.totalTurns} <Countdown …/>`, prompt `{view.prompt.text}` — its old muted h2 styling is intentionally upgraded to chalk).
  - **ImposterHost**: `word` (`Check your phones 🤫`), `clues` (`🎤 {view.currentSpeaker}`), `vote` (`Who&apos;s the imposter?`) phases.
  - **BluffHost**: `bluff` phase (`{view.question}`, with `className="mx-auto max-w-5xl"`) and `vote` phase (`{view.question}`).
  - **MafiaHost**: no PromptCard (different structure) — mapping only.
  - Not adopted (leave as plain h2/p with mapped classes): all `finished` headings, WstHost/ImposterHost/BluffHost reveal phases.

- [x] **Step 3: Class mapping, file-specific occurrences:**
  - **WyrHost**: option panels `bg-indigo-700` → `border border-orchid/50 bg-orchid/15`, `bg-rose-700` → `border border-punch/50 bg-punch/15`; remaining `text-slate-400` → `text-mist`.
  - **MltHost**: tally `bg-slate-800` li → `border border-line bg-stage`; both `text-slate-400` → `text-mist`.
  - **NhieHost**: yes-name chips `bg-rose-700` → `border border-punch/50 bg-punch/15`; eliminated banner `bg-amber-600` → `border border-honey/60 bg-honey/15 text-honey`; `text-slate-400` → `text-mist`.
  - **WstHost**: both blockquotes `bg-indigo-700` → `border border-orchid/50 bg-orchid/15`; `text-slate-400` → `text-mist`.
  - **ImposterHost**: speaker list `text-white` → `text-chalk`, `text-slate-600` → `text-mist/50`, `text-slate-400` → `text-mist`; caught banner ternary `view.caught ? 'bg-emerald-700' : 'bg-rose-700'` → `view.caught ? 'border-honey/60 bg-honey/15 text-honey' : 'border-punch/50 bg-punch/15 text-punch'` and add `border` to its static classes (`rounded-lg border px-6 py-3 text-2xl`); tally li `bg-slate-800` → `border border-line bg-stage`.
  - **BluffHost**: vote option cards `bg-slate-800` → `border border-line bg-stage`; truth panel `bg-emerald-700` → `border border-honey/60 bg-honey/15 text-honey`; result cards ternary `result.isTruth ? 'bg-emerald-800' : 'bg-slate-800'` → `result.isTruth ? 'border border-honey/60 bg-honey/10' : 'border border-line bg-stage'`; `text-slate-400` → `text-mist`.
  - **MafiaHost**: playerGrid alive `border-slate-600 bg-slate-800 text-white` → `border-line bg-stage text-chalk`, dead `border-slate-800 bg-slate-900 text-slate-600` → `border-line/50 bg-plum/60 text-mist/50`; `text-indigo-200` → `text-orchid`; `text-amber-200` → `text-honey` (×2); `text-rose-300` → `text-punch`; tally/roles `bg-slate-800` li → `border border-line bg-stage` (×2).

- [x] **Step 4: Verify**

Run: `pnpm -r typecheck && pnpm --filter @hpg/web e2e`
Expected: full e2e suite PASS (it drives WYR, MLT, Bluff, Mafia host screens end to end).

- [x] **Step 5: Commit**

```bash
git add apps/web/src/components/host
git commit -m "feat(web): warm re-skin of all seven host screens"
```

---

### Task 9: Re-skin the seven play (phone) components

Same rules as Task 8: canonical mapping table, `Button` conversions, no logic/string/structure changes. No PromptCard here. Each file needing it adds `import { Button } from '../ui/Button'`.

**Files:** Modify all of `apps/web/src/components/play/{WyrPlay,MltPlay,NhiePlay,WstPlay,ImposterPlay,BluffPlay,MafiaPlay}.tsx`

- [x] **Step 1: Button conversions:**
  - **WstPlay**: submit → `<Button onClick={() => draft.trim() && onSubmitAnswer(draft.trim())} disabled={!draft.trim()}>Submit</Button>`
  - **BluffPlay**: submit → `<Button onClick={submit} disabled={!draft.trim() || awaiting}>{awaiting ? 'Submitting…' : 'Submit bluff'}</Button>`
  - **ImposterPlay**: ready → `<Button size="lg" onClick={onReady}>Got it</Button>`

- [x] **Step 2: Class mapping, file-specific occurrences:**
  - **WyrPlay**: option ternary `c === 'a' ? 'bg-indigo-700' : 'bg-rose-700'` → `c === 'a' ? 'border border-orchid/50 bg-orchid/15' : 'border border-punch/50 bg-punch/15'`; `ring-white` → `ring-honey`; `text-slate-400` → `text-mist` (×3).
  - **MltPlay**: tally li + candidate buttons `bg-slate-800` → `border border-line bg-stage`; `ring-white` → `ring-honey`; `text-slate-400` → `text-mist`.
  - **NhiePlay**: yes-chips `bg-rose-700` → `border border-punch/50 bg-punch/15`; eliminated banner `bg-amber-600` → `border border-honey/60 bg-honey/15 text-honey`; "You're out" panel `bg-slate-800` → `border border-line bg-stage`; `I have` button `bg-rose-700` → `border border-punch/50 bg-punch/15`; `Never` button `bg-indigo-700` → `border border-orchid/50 bg-orchid/15`; `ring-white` → `ring-honey` (×2); `text-slate-400` → `text-mist` (×2).
  - **WstPlay**: waiting + "yours" panels `bg-slate-800` → `border border-line bg-stage`; textarea `bg-slate-800` → `border border-line bg-stage text-chalk placeholder:text-mist`; blockquotes `bg-indigo-700` → `border border-orchid/50 bg-orchid/15` (×2); candidate buttons `bg-slate-800` → `border border-line bg-stage`; `ring-white` → `ring-honey`; `text-slate-400` → `text-mist` (×3).
  - **ImposterPlay**: imposter card `bg-rose-800` → `border border-punch/50 bg-punch/15`; word card `bg-indigo-700` → `border border-orchid/50 bg-orchid/15`; `text-slate-300` → `text-chalk/80` (×3); clues info strip + vote buttons `bg-slate-800` → `border border-line bg-stage`; `ring-white` → `ring-honey`; caught ternary `view.caught ? 'bg-emerald-700' : 'bg-rose-700'` → `view.caught ? 'border-honey/60 bg-honey/15 text-honey' : 'border-punch/50 bg-punch/15 text-punch'` with `border` added to static classes (`rounded-lg border px-4 py-2 text-lg`); `text-slate-400` → `text-mist` (all).
  - **BluffPlay**: "Bluff locked in 😈" panel `bg-slate-800` → `border border-line bg-stage`; textarea → `border border-line bg-stage text-chalk placeholder:text-mist` (keep `w-full rounded-lg p-4 text-lg`); `text-amber-300` → `text-honey`; vote options `bg-slate-800` → `border border-line bg-stage`, `ring-white` → `ring-honey`, "yours" tag `bg-indigo-600` → `bg-orchid/30`; truth panel `bg-emerald-700` → `border border-honey/60 bg-honey/15 text-honey`; result ternary `result.isTruth ? 'bg-emerald-800' : 'bg-slate-800'` → `result.isTruth ? 'border border-honey/60 bg-honey/10' : 'border border-line bg-stage'`; `text-emerald-300` → `text-honey`; `text-slate-300` → `text-chalk/80`; `text-slate-400` → `text-mist` (all). Keep `text-red-400` error.
  - **MafiaPlay**: replace `ROLE_STYLES` with

```ts
const ROLE_STYLES: Record<MafiaRole, string> = {
  mafia: 'border-punch/60 bg-punch/15 text-chalk',
  detective: 'border-orchid/60 bg-orchid/15 text-chalk',
  doctor: 'border-honey/60 bg-honey/15 text-chalk',
  civilian: 'border-line bg-stage text-chalk',
}
```

  then: detective log section `bg-slate-900` → `border border-line bg-plum/60`, heading `text-sky-300` → `text-orchid`, empty text `text-slate-500` → `text-mist/70`, entries `bg-slate-800` → `border border-line bg-stage`; spectator banner `border-slate-600 bg-slate-900 … text-slate-300` → `border-line bg-plum/60 … text-chalk/80`; night label `text-indigo-300` → `text-orchid`; candidate buttons (night AND vote) `bg-slate-800 … hover:bg-slate-700` → `border border-line bg-stage … hover:bg-chalk/10` and `focus-visible:outline-white` → `focus-visible:outline-honey`; `ring-indigo-400` → `ring-orchid`; `ring-amber-400` → `ring-honey`; sleep panel `bg-indigo-950/60` → `border border-orchid/30 bg-orchid/10`; day `text-amber-200` → `text-honey`; reveal `text-rose-300` → `text-punch`; tally + allRoles li `bg-slate-800` → `border border-line bg-stage`; `text-slate-400` → `text-mist`.

- [x] **Step 3: Verify**

Run: `pnpm --filter @hpg/web test && pnpm -r typecheck && pnpm --filter @hpg/web e2e`
Expected: everything PASS (bluff-battle and mafia specs exercise most of these phone screens, including the Button conversions).

- [x] **Step 4: Commit**

```bash
git add apps/web/src/components/play
git commit -m "feat(web): warm re-skin of all seven play screens"
```

---

### Task 10: Full verification sweep

- [x] **Step 1: Full automated pass**

Run: `pnpm format && pnpm -r test && pnpm -r typecheck && pnpm lint && pnpm --filter @hpg/web e2e`
Expected: all green. Fix forward anything that isn't; do not weaken tests.

- [x] **Step 2: Visual pass on the dev servers** (host on desktop viewport, join on mobile viewport):
  1. `/` and one `/games/[slug]` — warm theme, no leftover cool colors, focus ring honey.
  2. `/host` — lobby, copy link, spicy confirm, then start each of WYR and Mafia and click through 2–3 phases on the TV view.
  3. `/join` — code tiles (type + paste), lobby chips pop in, then the matching phone views for the games above.
  4. Reduced motion (OS setting or devtools emulation): no chip pop, no pulse, no marquee float.
  5. Contrast spot-check with devtools on: `text-mist` on plum, `text-honey` on `bg-honey/15`, plum text on the gradient Button. All must report ≥ 4.5:1.

- [x] **Step 3: Mark the plan complete and commit**

```bash
git add docs/superpowers/plans/2026-07-16-warm-living-room-redesign.md
git commit -m "docs: mark warm living room redesign plan complete"
```
