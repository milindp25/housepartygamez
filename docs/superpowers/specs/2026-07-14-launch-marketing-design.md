# HousePartyGamez Launch Marketing Design

**Date:** 2026-07-14  
**Status:** Approved, implemented, and locally verified

**Related plan:** `docs/superpowers/plans/2026-07-13-plan-5-launch.md`

## Purpose

Replace the default Next.js homepage with a public landing experience that explains the TV-and-phones party format, moves visitors directly into hosting or joining, and gives every current game a crawlable, useful detail page. The implementation covers the current seven-game catalog rather than Plan 5's stale four-game assumption.

The audience is a group organizer choosing something to play now. The page's single job is to make the interaction model obvious and get that person to **Host a game** or **Join a room** without requiring an account.

## Design direction: House lights

The site should feel like the room has dimmed and the game is about to begin: a disciplined midnight foundation with concentrated bursts of party color. It should share the dark, high-contrast character of the host/game screens without looking like an admin dashboard.

The signature element is a six-tile room-code marquee in the hero. The oversized tiles visually teach the product's core loop—one shared screen, short code, everyone joins on a phone—before the supporting copy explains it.

### Visual tokens

- **Midnight:** `#070B16` — page background and deepest surfaces
- **Stage:** `#11182A` — cards and raised sections
- **Chalk:** `#F8FAFC` — primary text
- **Electric iris:** `#7C3AED` — primary action and brand energy
- **Signal lime:** `#A3E635` — join/action confirmation
- **Hot coral:** `#FB7185` — warm game accents
- **Electric cyan:** `#22D3EE` — cool game accents and metadata

Typography uses the existing Geist Sans for readable display/body copy and Geist Mono for room codes, labels, player counts, and timing. The contrast between broad, tightly tracked display text and monospaced game data supplies the typographic identity without introducing another network font dependency.

Motion is concentrated in the room-code marquee: a restrained load-in or ambient light shift when motion is allowed. Cards may lift slightly on hover. All motion must stop under `prefers-reduced-motion`.

## Information architecture

### Shared game registry

`apps/web/src/lib/games.ts` is the single marketing registry. Each of the seven entries contains:

- stable route slug and engine game ID
- display name and short tagline
- approximately 100–140 words of plain-language description
- minimum and maximum player guidance
- estimated duration
- ordered how-to-play steps
- one visual accent token chosen from the launch palette

The seven entries are Would You Rather, Most Likely To, Never Have I Ever, Who Said That?, Imposter, Bluff Battle, and Mafia. Mafia's marketing guidance says 6–20 players while retaining the engine's four-player technical testing floor.

Current engine and host-flow behavior is authoritative for public guidance. Never Have I Ever is a 3–20 player game and the exposed flow uses its classic defaults; marketing copy must not advertise selectable reveal or elimination settings that the host UI does not expose. Imposter is a 4–20 player game.

### Landing page `/`

1. **Hero:** headline “Party games everyone plays on their phones,” short explanation, Host and Join CTAs, and the room-code marquee.
2. **How the room works:** a real three-step sequence—host on the shared screen, friends join with a code, everyone plays from a phone.
3. **Game deck:** seven cards generated from the registry. Each card shows name, tagline, player range, duration, and a direct detail-page link.
4. **Closing invitation:** repeat Host and Join actions after the catalog.

Desktop composition uses an asymmetric hero: copy/actions occupy the left side and the room-code marquee behaves like a lit tabletop object on the right. Mobile stacks the marquee below the primary action without reducing the room code below comfortable camera-distance legibility.

### Game pages `/games/[slug]`

Every registry entry generates a static route and metadata:

- title: `Play {name} Online with Friends`
- a 120–160-character search description generated from the registry tagline, name, player range, and duration
- canonical game name, player range, and duration above the fold
- the full 100–140 word registry description as body copy
- ordered how-to-play steps
- a clear `Host {name}` CTA linking to `/host`
- a link back to the full game deck

Unknown slugs use the framework's not-found behavior. Page copy must not claim modes, content, payment features, or live deployment capabilities that the game does not have.

Design refinement (2026-07-14): search metadata uses the concise generated summary instead of the full registry description. This keeps every description useful in search previews and avoids publishing 700-plus-character meta descriptions, while preserving the complete explanatory copy on the page.

## Component boundaries

- The registry owns marketing data and lookup helpers only; it has no React or socket dependencies.
- The landing page and game route are server components that render registry data.
- Small presentational components may be extracted when they clarify a repeated unit such as a game card or room-code marquee, but socket/gameplay logic must not enter marketing pages.
- Existing `/host` and `/join` application flows remain behaviorally unchanged.

## Accessibility and responsive behavior

- Chalk-on-midnight text and every accent combination must meet WCAG AA contrast for its actual text size.
- Both primary actions remain keyboard reachable with visible focus states.
- Card links have descriptive accessible names; decorative marquee characters are hidden when equivalent text is already announced.
- Heading order is semantic and each game page has one `h1`.
- The layout supports 320 px widths without horizontal scrolling.
- Hover is never the only way to discover information.
- Reduced-motion preferences remove ambient and entrance animation.

## Error handling and resilience

- Static generation is driven by the typed registry, preventing route/data drift.
- Registry lookup returns an explicit missing result so the dynamic route can call `notFound()`.
- Marketing pages require no database, authentication, analytics, or game-server connection at build time.
- Copy and layout remain complete when JavaScript analytics is disabled.

## Verification

- Unit coverage validates unique slugs/IDs and successful registry lookup for all seven games.
- `generateStaticParams` covers every registry entry and missing slugs return not found.
- Browser coverage verifies that every generated metadata description is 120–160 characters; detail-page review confirms that the full registry description remains body copy.
- Production build and repository lint pass with no application secrets.
- Browser checks cover hero actions, all seven game links, one game detail page, keyboard focus, and a mobile viewport without horizontal overflow.
- Metadata is inspected for `/` and at least one `/games/*` route.
- Lighthouse performance and SEO targets remain part of Plan 5's production launch checklist; local implementation must not claim those production results.

## Scope boundaries

This design does not redesign the active host/player game screens, add illustrations that require a separate asset pipeline, introduce authentication, or create additional game modes. Analytics and QR-code integration remain separate Plan 5 tasks that should visually fit the token system without changing this page architecture.

## Plan deviation

Plan 5 was written when only four launch games were expected. Plans 6–8 are now complete, so the public registry and static pages cover all seven implemented games. This is a current-repository correction, not a new game feature.

Catalog correction (2026-07-14): implementation review found stale draft floors of two players for Never Have I Ever and three for Imposter, plus copy that exposed internal Never Have I Ever settings. The design now follows the engine floors and the currently available classic host flow.
