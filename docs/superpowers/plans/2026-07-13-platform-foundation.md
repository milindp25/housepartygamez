# Platform Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Monorepo scaffold + full room lifecycle: a host screen creates a room with a 4-letter code, players join from phones with a nickname, everyone sees a live lobby, and disconnected players reconnect to their seat.

**Architecture:** pnpm-workspace monorepo. `packages/shared` holds the socket protocol types and room-code generator (pure TS, imported as source by both apps). `apps/game-server` is a Node + Socket.IO server holding all room state in memory via a pure, unit-testable `RoomManager` class. `apps/web` is a Next.js App Router app with a `/host` page (TV) and `/join` page (phones), both dumb renderers of server-sent `room:state` views.

**Tech Stack:** TypeScript (strict), pnpm workspaces, Socket.IO v4 (+ socket.io-client), Next.js 15 (App Router, Tailwind), Vitest, tsx (server dev runner), ESLint + Prettier (enforced), pino structured JSON logging. Node 20+.

**Standards (apply to every task):** JSDoc on every exported function/class/type; inline comments explain *why*, not *what*. All game-server events logged as structured JSON via pino with an `event` name + context fields (`roomCode`, `playerId`, `socketId`). `pnpm lint` must pass before each commit.

**Spec:** `docs/superpowers/specs/2026-07-13-housepartygamez-design.md`

This is plan 1 of 5 for v1. Later plans: (2) round engine + Would You Rather, (3) remaining 3 games, (4) auth + custom packs, (5) marketing + deploy.

---

## File structure

```
housepartygamez/
├── package.json                     # root: workspace scripts only
├── pnpm-workspace.yaml
├── tsconfig.base.json               # shared compiler options
├── eslint.config.js                 # typescript-eslint for packages + game-server
├── .prettierrc / .prettierignore
├── .gitignore
├── packages/shared/
│   ├── package.json                 # name @hpg/shared, exports TS source
│   ├── tsconfig.json
│   └── src/
│       ├── index.ts                 # re-exports
│       ├── protocol.ts              # socket event types + RoomView (the client/server contract)
│       ├── roomCode.ts              # 4-letter code generator, injectable RNG
│       └── roomCode.test.ts
└── apps/
    ├── game-server/
    │   ├── package.json             # name @hpg/game-server
    │   ├── tsconfig.json
    │   └── src/
    │       ├── logger.ts            # pino structured JSON logger (shared conventions)
    │       ├── roomManager.ts       # ALL room rules, pure class (no sockets, no timers)
    │       ├── roomManager.test.ts
    │       ├── server.ts            # attachGameServer(): socket wiring only, no rules
    │       ├── server.test.ts       # integration over real sockets
    │       └── index.ts             # entry: http server + expiry sweep interval
    └── web/                         # created by create-next-app, then add:
        ├── next.config.ts           # transpilePackages: ['@hpg/shared']
        └── src/
            ├── lib/socket.ts        # socket singleton + playerToken (localStorage)
            └── app/
                ├── host/page.tsx    # TV: create room, show code + live player list
                └── join/page.tsx    # phone: code + nickname form → lobby view
```

Responsibilities: `RoomManager` owns every room rule (join validation, reconnect, expiry) so it's all unit-testable; `server.ts` only translates socket events ↔ manager calls and broadcasts views; pages only render views.

---

### Task 1: Monorepo scaffold + lint/format tooling

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `tsconfig.base.json`, `.gitignore`
- Create: `eslint.config.js`, `.prettierrc`, `.prettierignore`

- [ ] **Step 1: Create root files**

`package.json`:
```json
{
  "name": "housepartygamez",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "pnpm -r test",
    "lint": "eslint . && prettier --check .",
    "format": "prettier --write .",
    "dev:server": "pnpm --filter @hpg/game-server dev",
    "dev:web": "pnpm --filter @hpg/web dev"
  },
  "devDependencies": {
    "eslint": "^9.18.0",
    "prettier": "^3.4.0",
    "typescript-eslint": "^8.20.0"
  },
  "packageManager": "pnpm@9.15.0"
}
```

`pnpm-workspace.yaml`:
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

`tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true
  }
}
```

`.gitignore`:
```
node_modules/
.next/
dist/
*.tsbuildinfo
.env*.local
```

- [ ] **Step 2: Create lint and format config**

`eslint.config.js` (flat config; the web app keeps its own Next.js ESLint setup, so it's excluded here):
```js
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**', 'apps/web/**'] },
  ...tseslint.configs.recommended,
)
```

`.prettierrc`:
```json
{ "semi": false, "singleQuote": true, "printWidth": 100 }
```

`.prettierignore`:
```
node_modules/
.next/
dist/
pnpm-lock.yaml
```

- [ ] **Step 3: Verify pnpm resolves the workspace and lint runs clean**

Run: `pnpm install && pnpm lint`
Expected: install completes; eslint and prettier exit 0 (nothing to lint yet is fine).

- [ ] **Step 4: Commit**

```bash
git add package.json pnpm-workspace.yaml tsconfig.base.json .gitignore eslint.config.js .prettierrc .prettierignore pnpm-lock.yaml
git commit -m "chore: scaffold pnpm workspace monorepo with lint/format tooling"
```

---

### Task 2: Shared package with room-code generator (TDD)

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`
- Create: `packages/shared/src/roomCode.ts`, `packages/shared/src/index.ts`
- Test: `packages/shared/src/roomCode.test.ts`

- [ ] **Step 1: Create the package**

`packages/shared/package.json`:
```json
{
  "name": "@hpg/shared",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "exports": { ".": "./src/index.ts" },
  "scripts": { "test": "vitest run" },
  "devDependencies": { "typescript": "^5.7.0", "vitest": "^3.0.0" }
}
```

`packages/shared/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

Run: `pnpm install`

- [ ] **Step 2: Write the failing test**

`packages/shared/src/roomCode.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { ROOM_CODE_ALPHABET, generateRoomCode } from './roomCode'

describe('generateRoomCode', () => {
  it('generates 4 characters from the safe alphabet', () => {
    const code = generateRoomCode()
    expect(code).toHaveLength(4)
    for (const ch of code) expect(ROOM_CODE_ALPHABET).toContain(ch)
  })

  it('excludes ambiguous characters O, I, 0, 1', () => {
    for (const ch of ['O', 'I', '0', '1']) expect(ROOM_CODE_ALPHABET).not.toContain(ch)
  })

  it('is deterministic given an injected RNG', () => {
    const rng = () => 0 // always first letter
    expect(generateRoomCode(rng)).toBe('AAAA')
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `pnpm --filter @hpg/shared test`
Expected: FAIL — cannot resolve `./roomCode`.

- [ ] **Step 4: Write minimal implementation**

`packages/shared/src/roomCode.ts`:
```ts
// 24 letters: A-Z minus O and I (lookalikes of 0 and 1)
export const ROOM_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'

export function generateRoomCode(random: () => number = Math.random): string {
  let code = ''
  for (let i = 0; i < 4; i++) {
    code += ROOM_CODE_ALPHABET[Math.floor(random() * ROOM_CODE_ALPHABET.length)]
  }
  return code
}
```

`packages/shared/src/index.ts`:
```ts
export * from './roomCode'
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @hpg/shared test`
Expected: 3 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/shared
git commit -m "feat: shared package with room code generator"
```

---

### Task 3: Socket protocol types

**Files:**
- Create: `packages/shared/src/protocol.ts`
- Modify: `packages/shared/src/index.ts`

Types only — no test, but they are the contract every later task imports, so they must compile.

- [ ] **Step 1: Write the protocol**

`packages/shared/src/protocol.ts`:
```ts
export interface PlayerInfo {
  id: string
  nickname: string
  connected: boolean
}

/** What every client renders. Lobby has no secrets, so one view for all. */
export interface RoomView {
  code: string
  phase: 'lobby'
  players: PlayerInfo[]
}

export type JoinResult =
  | { ok: true; playerId: string; view: RoomView }
  | { ok: false; error: string }

export type WatchResult =
  | { ok: true; view: RoomView }
  | { ok: false; error: string }

export interface ClientToServerEvents {
  /** Host screen creates a room. */
  'room:create': (ack: (res: { code: string }) => void) => void
  /** Host screen (re)opens an existing room's public view. */
  'room:watch': (payload: { code: string }, ack: (res: WatchResult) => void) => void
  /** Player joins (or reconnects — same playerToken restores the seat). */
  'room:join': (
    payload: { code: string; nickname: string; playerToken: string },
    ack: (res: JoinResult) => void,
  ) => void
}

export interface ServerToClientEvents {
  'room:state': (view: RoomView) => void
}
```

`packages/shared/src/index.ts`:
```ts
export * from './roomCode'
export * from './protocol'
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @hpg/shared exec tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src
git commit -m "feat: socket protocol types for room lifecycle"
```

---

### Task 4: RoomManager (TDD)

**Files:**
- Create: `apps/game-server/package.json`, `apps/game-server/tsconfig.json`
- Create: `apps/game-server/src/roomManager.ts`
- Test: `apps/game-server/src/roomManager.test.ts`

- [ ] **Step 1: Create the package**

`apps/game-server/package.json`:
```json
{
  "name": "@hpg/game-server",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "tsx src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@hpg/shared": "workspace:*",
    "pino": "^9.6.0",
    "socket.io": "^4.8.0"
  },
  "devDependencies": {
    "pino-pretty": "^13.0.0",
    "socket.io-client": "^4.8.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

`apps/game-server/tsconfig.json`:
```json
{ "extends": "../../tsconfig.base.json", "include": ["src"] }
```

Run: `pnpm install`

- [ ] **Step 2: Write the failing tests**

`apps/game-server/src/roomManager.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest'
import { RoomManager } from './roomManager'

describe('RoomManager', () => {
  let clock: { now: number }
  let rooms: RoomManager

  beforeEach(() => {
    clock = { now: 1_000_000 }
    rooms = new RoomManager({ now: () => clock.now })
  })

  it('creates a room with a 4-letter code and empty lobby', () => {
    const room = rooms.createRoom()
    expect(room.code).toMatch(/^[A-Z]{4}$/)
    expect(rooms.toView(room)).toEqual({ code: room.code, phase: 'lobby', players: [] })
  })

  it('regenerates on code collision', () => {
    // RNG that yields the same code twice, then a different one
    const values = [0, 0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 0.5, 0.5]
    const rng = () => values.shift() ?? Math.random()
    const collider = new RoomManager({ now: () => clock.now, random: rng })
    const a = collider.createRoom()
    const b = collider.createRoom()
    expect(b.code).not.toBe(a.code)
  })

  it('joins a player by code, case-insensitive', () => {
    const room = rooms.createRoom()
    const res = rooms.join(room.code.toLowerCase(), 'Milind', 'tok-1')
    expect(res).toMatchObject({ player: { nickname: 'Milind', connected: true } })
    expect(rooms.toView(room).players).toHaveLength(1)
  })

  it('rejects unknown room, blank nickname, and duplicate nickname', () => {
    const room = rooms.createRoom()
    expect(rooms.join('XXXX', 'A', 'tok-1')).toEqual({ error: 'Room not found' })
    expect(rooms.join(room.code, '   ', 'tok-1')).toEqual({ error: 'Nickname required' })
    rooms.join(room.code, 'Milind', 'tok-1')
    expect(rooms.join(room.code, 'milind', 'tok-2')).toEqual({ error: 'Nickname taken' })
  })

  it('rejects joins beyond 20 players', () => {
    const room = rooms.createRoom()
    for (let i = 0; i < 20; i++) rooms.join(room.code, `p${i}`, `tok-${i}`)
    expect(rooms.join(room.code, 'late', 'tok-late')).toEqual({ error: 'Room full' })
  })

  it('reconnects the same token to the same seat', () => {
    const room = rooms.createRoom()
    const first = rooms.join(room.code, 'Milind', 'tok-1')
    if ('error' in first) throw new Error('join failed')
    rooms.setConnected(room.code, 'tok-1', false)
    expect(rooms.toView(room).players[0].connected).toBe(false)

    const again = rooms.join(room.code, 'Milind', 'tok-1')
    if ('error' in again) throw new Error('rejoin failed')
    expect(again.player.id).toBe(first.player.id) // same seat
    expect(rooms.toView(room).players).toHaveLength(1)
    expect(rooms.toView(room).players[0].connected).toBe(true)
  })

  it('expires rooms idle past the limit, keeps active ones', () => {
    const idle = rooms.createRoom()
    clock.now += 30 * 60_000
    const active = rooms.createRoom()
    clock.now += 31 * 60_000 // idle is 61min old, active 31min

    const expired = rooms.sweepExpired(60 * 60_000)
    expect(expired).toEqual([idle.code])
    expect(rooms.getRoom(idle.code)).toBeUndefined()
    expect(rooms.getRoom(active.code)).toBeDefined()
  })

  it('any activity (join) resets the idle clock', () => {
    const room = rooms.createRoom()
    clock.now += 59 * 60_000
    rooms.join(room.code, 'Milind', 'tok-1')
    clock.now += 59 * 60_000
    expect(rooms.sweepExpired(60 * 60_000)).toEqual([])
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `pnpm --filter @hpg/game-server test`
Expected: FAIL — cannot resolve `./roomManager`.

- [ ] **Step 4: Implement RoomManager**

`apps/game-server/src/roomManager.ts`:
```ts
import { generateRoomCode, type RoomView } from '@hpg/shared'

export interface RoomPlayer {
  id: string
  token: string
  nickname: string
  connected: boolean
}

export interface Room {
  code: string
  players: RoomPlayer[]
  lastActivityAt: number
}

const MAX_PLAYERS = 20

export class RoomManager {
  private rooms = new Map<string, Room>()
  private now: () => number
  private random: () => number
  private nextPlayerId = 1

  constructor(opts: { now?: () => number; random?: () => number } = {}) {
    this.now = opts.now ?? Date.now
    this.random = opts.random ?? Math.random
  }

  createRoom(): Room {
    let code = generateRoomCode(this.random)
    while (this.rooms.has(code)) code = generateRoomCode(this.random)
    const room: Room = { code, players: [], lastActivityAt: this.now() }
    this.rooms.set(code, room)
    return room
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code.toUpperCase())
  }

  join(
    code: string,
    nickname: string,
    token: string,
  ): { room: Room; player: RoomPlayer } | { error: string } {
    const room = this.getRoom(code)
    if (!room) return { error: 'Room not found' }
    room.lastActivityAt = this.now()

    const existing = room.players.find((p) => p.token === token)
    if (existing) {
      existing.connected = true
      return { room, player: existing }
    }

    const name = nickname.trim()
    if (!name) return { error: 'Nickname required' }
    if (room.players.some((p) => p.nickname.toLowerCase() === name.toLowerCase())) {
      return { error: 'Nickname taken' }
    }
    if (room.players.length >= MAX_PLAYERS) return { error: 'Room full' }

    const player: RoomPlayer = {
      id: `p${this.nextPlayerId++}`,
      token,
      nickname: name,
      connected: true,
    }
    room.players.push(player)
    return { room, player }
  }

  setConnected(code: string, token: string, connected: boolean): Room | undefined {
    const room = this.getRoom(code)
    const player = room?.players.find((p) => p.token === token)
    if (!room || !player) return undefined
    player.connected = connected
    room.lastActivityAt = this.now()
    return room
  }

  sweepExpired(maxIdleMs: number): string[] {
    const expired: string[] = []
    for (const [code, room] of this.rooms) {
      if (this.now() - room.lastActivityAt > maxIdleMs) {
        this.rooms.delete(code)
        expired.push(code)
      }
    }
    return expired
  }

  toView(room: Room): RoomView {
    return {
      code: room.code,
      phase: 'lobby',
      players: room.players.map(({ id, nickname, connected }) => ({ id, nickname, connected })),
    }
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @hpg/game-server test`
Expected: 8 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/game-server
git commit -m "feat: RoomManager with join, reconnect, and expiry rules"
```

---

### Task 5: Socket.IO wiring + structured logging + integration test

**Files:**
- Create: `apps/game-server/src/logger.ts`, `apps/game-server/src/server.ts`, `apps/game-server/src/index.ts`
- Test: `apps/game-server/src/server.test.ts`

- [ ] **Step 1: Write the failing integration test**

`apps/game-server/src/server.test.ts`:
```ts
import { createServer, type Server as HttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { io as connect, type Socket } from 'socket.io-client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { ClientToServerEvents, JoinResult, RoomView, ServerToClientEvents } from '@hpg/shared'
import { attachGameServer } from './server'

type Client = Socket<ServerToClientEvents, ClientToServerEvents>

let httpServer: HttpServer
let url: string
const clients: Client[] = []

function client(): Client {
  const c: Client = connect(url, { transports: ['websocket'] })
  clients.push(c)
  return c
}

function nextState(c: Client): Promise<RoomView> {
  return new Promise((resolve) => c.once('room:state', resolve))
}

beforeAll(async () => {
  httpServer = createServer()
  attachGameServer(httpServer)
  await new Promise<void>((resolve) => httpServer.listen(0, resolve))
  url = `http://localhost:${(httpServer.address() as AddressInfo).port}`
})

afterAll(async () => {
  for (const c of clients) c.disconnect()
  await new Promise<void>((resolve) => httpServer.close(() => resolve()))
})

describe('game server sockets', () => {
  it('host creates a room, player joins, everyone gets lobby state', async () => {
    const host = client()
    const { code } = await host.emitWithAck('room:create')
    expect(code).toMatch(/^[A-Z]{4}$/)

    const phone = client()
    const stateAtHost = nextState(host)
    const join = await phone.emitWithAck('room:join', {
      code,
      nickname: 'Milind',
      playerToken: 'tok-1',
    })
    expect(join.ok).toBe(true)
    const view = await stateAtHost
    expect(view.players).toEqual([{ id: expect.any(String), nickname: 'Milind', connected: true }])
  })

  it('join errors are returned in the ack', async () => {
    const phone = client()
    const res: JoinResult = await phone.emitWithAck('room:join', {
      code: 'XXXX',
      nickname: 'Nobody',
      playerToken: 'tok-x',
    })
    expect(res).toEqual({ ok: false, error: 'Room not found' })
  })

  it('disconnect marks the player disconnected; same token reconnects to the seat', async () => {
    const host = client()
    const { code } = await host.emitWithAck('room:create')

    const phone = client()
    const joined = await phone.emitWithAck('room:join', {
      code,
      nickname: 'Ana',
      playerToken: 'tok-ana',
    })
    if (!joined.ok) throw new Error(joined.error)

    const afterDrop = nextState(host)
    phone.disconnect()
    expect((await afterDrop).players[0].connected).toBe(false)

    const afterRejoin = nextState(host)
    const phone2 = client()
    const rejoined = await phone2.emitWithAck('room:join', {
      code,
      nickname: 'Ana',
      playerToken: 'tok-ana',
    })
    if (!rejoined.ok) throw new Error(rejoined.error)
    expect(rejoined.playerId).toBe(joined.playerId)
    const view = await afterRejoin
    expect(view.players).toHaveLength(1)
    expect(view.players[0].connected).toBe(true)
  })

  it('a second host screen can watch an existing room', async () => {
    const host = client()
    const { code } = await host.emitWithAck('room:create')
    const tv2 = client()
    const res = await tv2.emitWithAck('room:watch', { code })
    expect(res).toEqual({ ok: true, view: { code, phase: 'lobby', players: [] } })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @hpg/game-server test`
Expected: server.test.ts FAILS — cannot resolve `./server`. (roomManager tests still pass.)

- [ ] **Step 3: Create the structured logger**

`apps/game-server/src/logger.ts`:
```ts
import { pino } from 'pino'

/**
 * Structured JSON logger — one JSON object per line so log aggregators
 * (Railway, Datadog, Loki, CloudWatch) can index and search fields directly.
 *
 * Conventions:
 * - every entry carries an `event` name (snake_case) plus context fields
 *   such as `roomCode`, `playerId`, `socketId`
 * - `info` = lifecycle, `warn` = rejected/invalid client actions, `error` = exceptions
 * - production emits raw JSON; dev pretty-prints; tests are silent
 */
export const logger = pino({
  level: process.env.LOG_LEVEL ?? (process.env.NODE_ENV === 'test' ? 'silent' : 'info'),
  transport:
    process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty' },
})
```

- [ ] **Step 4: Implement the socket wiring**

`apps/game-server/src/server.ts`:
```ts
import type { Server as HttpServer } from 'node:http'
import { Server } from 'socket.io'
import type { ClientToServerEvents, ServerToClientEvents } from '@hpg/shared'
import { logger } from './logger'
import { RoomManager } from './roomManager'

/** Per-connection bookkeeping so `disconnect` knows which seat to release. */
interface SocketData {
  roomCode?: string
  playerToken?: string
}

/**
 * Attaches the Socket.IO game server to an HTTP server.
 *
 * This layer only translates socket events into RoomManager calls and
 * broadcasts the resulting views — all room *rules* live in RoomManager,
 * which keeps them unit-testable without sockets.
 */
export function attachGameServer(httpServer: HttpServer, rooms = new RoomManager()) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(
    httpServer,
    { cors: { origin: process.env.CORS_ORIGIN ?? '*' } },
  )

  io.on('connection', (socket) => {
    // Child logger: every line for this connection is traceable by socketId.
    const log = logger.child({ socketId: socket.id })
    log.info({ event: 'socket_connected' })

    socket.on('room:create', (ack) => {
      const room = rooms.createRoom()
      socket.data.roomCode = room.code
      void socket.join(room.code)
      log.info({ event: 'room_created', roomCode: room.code })
      ack({ code: room.code })
    })

    socket.on('room:watch', ({ code }, ack) => {
      const room = rooms.getRoom(code)
      if (!room) {
        log.warn({ event: 'watch_rejected', roomCode: code, reason: 'Room not found' })
        return ack({ ok: false, error: 'Room not found' })
      }
      socket.data.roomCode = room.code
      void socket.join(room.code)
      log.info({ event: 'room_watched', roomCode: room.code })
      ack({ ok: true, view: rooms.toView(room) })
    })

    socket.on('room:join', ({ code, nickname, playerToken }, ack) => {
      const result = rooms.join(code, nickname, playerToken)
      if ('error' in result) {
        log.warn({ event: 'join_rejected', roomCode: code, reason: result.error })
        return ack({ ok: false, error: result.error })
      }
      socket.data.roomCode = result.room.code
      socket.data.playerToken = playerToken
      void socket.join(result.room.code)
      log.info({
        event: 'player_joined',
        roomCode: result.room.code,
        playerId: result.player.id,
        nickname: result.player.nickname,
      })
      ack({ ok: true, playerId: result.player.id, view: rooms.toView(result.room) })
      io.to(result.room.code).emit('room:state', rooms.toView(result.room))
    })

    socket.on('disconnect', () => {
      const { roomCode, playerToken } = socket.data
      if (!roomCode || !playerToken) return
      const room = rooms.setConnected(roomCode, playerToken, false)
      if (!room) return
      const player = room.players.find((p) => p.token === playerToken)
      log.info({ event: 'player_disconnected', roomCode, playerId: player?.id })
      io.to(roomCode).emit('room:state', rooms.toView(room))
    })
  })

  return { io, rooms }
}
```

`apps/game-server/src/index.ts`:
```ts
import { createServer } from 'node:http'
import { logger } from './logger'
import { attachGameServer } from './server'

/** Rooms idle longer than this are deleted; any join/disconnect resets the clock. */
const ROOM_IDLE_MS = 60 * 60_000
const SWEEP_INTERVAL_MS = 60_000
const port = Number(process.env.PORT ?? 4000)

const httpServer = createServer()
const { io, rooms } = attachGameServer(httpServer)

setInterval(() => {
  const expired = rooms.sweepExpired(ROOM_IDLE_MS)
  if (expired.length === 0) return
  logger.info({ event: 'rooms_expired', roomCodes: expired })
  for (const code of expired) {
    io.in(code).disconnectSockets()
  }
}, SWEEP_INTERVAL_MS)

httpServer.listen(port, () => {
  logger.info({ event: 'server_started', port })
})
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @hpg/game-server test`
Expected: all tests PASS (8 unit + 4 integration), with no log noise (test level is silent).

- [ ] **Step 6: Lint and commit**

```bash
pnpm lint
git add apps/game-server/src
git commit -m "feat: socket.io server with room lifecycle, JSON logging, expiry sweep"
```

---

### Task 6: Next.js app scaffold

**Files:**
- Create: `apps/web/` via create-next-app
- Modify: `apps/web/next.config.ts`, `apps/web/package.json`

- [ ] **Step 1: Scaffold**

Run from repo root:
```bash
pnpm create next-app@latest apps/web --ts --app --tailwind --eslint --src-dir --no-import-alias --use-pnpm
```

- [ ] **Step 2: Rename package and add deps**

In `apps/web/package.json`, set `"name": "@hpg/web"`, then:
```bash
pnpm --filter @hpg/web add socket.io-client @hpg/shared@workspace:*
```

- [ ] **Step 3: Transpile the shared package**

`apps/web/next.config.ts`:
```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@hpg/shared'],
}

export default nextConfig
```

- [ ] **Step 4: Verify it builds**

Run: `pnpm --filter @hpg/web build`
Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add apps/web pnpm-lock.yaml
git commit -m "chore: scaffold Next.js web app"
```

---

### Task 7: Socket client helper

**Files:**
- Create: `apps/web/src/lib/socket.ts`

Browser-only glue (singleton + localStorage); exercised by the manual verification and later e2e, not unit tests.

- [ ] **Step 1: Write the helper**

`apps/web/src/lib/socket.ts`:
```ts
'use client'
import { io, type Socket } from 'socket.io-client'
import type { ClientToServerEvents, ServerToClientEvents } from '@hpg/shared'

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>

let socket: GameSocket | null = null

export function getSocket(): GameSocket {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_GAME_SERVER_URL ?? 'http://localhost:4000', {
      transports: ['websocket'],
    })
  }
  return socket
}

/** Stable per-device identity; lets a reloaded/reconnected phone reclaim its seat. */
export function getPlayerToken(): string {
  const KEY = 'hpg:playerToken'
  let token = localStorage.getItem(KEY)
  if (!token) {
    token = crypto.randomUUID()
    localStorage.setItem(KEY, token)
  }
  return token
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @hpg/web exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/socket.ts
git commit -m "feat: socket client singleton with player token"
```

---

### Task 8: Host page (TV screen)

**Files:**
- Create: `apps/web/src/app/host/page.tsx`

- [ ] **Step 1: Write the page**

`apps/web/src/app/host/page.tsx`:
```tsx
'use client'
import { useEffect, useState } from 'react'
import type { RoomView } from '@hpg/shared'
import { getSocket } from '@/lib/socket'

export default function HostPage() {
  const [view, setView] = useState<RoomView | null>(null)

  useEffect(() => {
    const socket = getSocket()
    socket.emit('room:create', ({ code }) => {
      setView({ code, phase: 'lobby', players: [] })
    })
    socket.on('room:state', setView)
    return () => {
      socket.off('room:state', setView)
    }
  }, [])

  if (!view) return <main className="grid min-h-screen place-items-center">Creating room…</main>

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 text-white">
      <div className="text-center">
        <p className="text-xl text-slate-400">Join at {typeof window !== 'undefined' ? window.location.host : ''}/join with code</p>
        <p className="my-6 font-mono text-8xl font-bold tracking-[0.3em]">{view.code}</p>
        <ul className="flex flex-wrap justify-center gap-3">
          {view.players.map((p) => (
            <li
              key={p.id}
              className={`rounded-full px-4 py-2 text-lg ${p.connected ? 'bg-emerald-600' : 'bg-slate-700 line-through'}`}
            >
              {p.nickname}
            </li>
          ))}
        </ul>
        {view.players.length === 0 && <p className="text-slate-500">Waiting for players…</p>}
      </div>
    </main>
  )
}
```

- [ ] **Step 2: Verify it compiles**

Run: `pnpm --filter @hpg/web exec tsc --noEmit`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/host
git commit -m "feat: host screen with room code and live lobby"
```

---

### Task 9: Join page (phone)

**Files:**
- Create: `apps/web/src/app/join/page.tsx`

- [ ] **Step 1: Write the page**

`apps/web/src/app/join/page.tsx`:
```tsx
'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import type { RoomView } from '@hpg/shared'
import { getPlayerToken, getSocket } from '@/lib/socket'

function JoinForm() {
  const params = useSearchParams()
  const [code, setCode] = useState(params.get('code') ?? '')
  const [nickname, setNickname] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<RoomView | null>(null)

  useEffect(() => {
    const socket = getSocket()
    socket.on('room:state', setView)
    return () => {
      socket.off('room:state', setView)
    }
  }, [])

  function join(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    getSocket().emit(
      'room:join',
      { code: code.trim(), nickname, playerToken: getPlayerToken() },
      (res) => (res.ok ? setView(res.view) : setError(res.error)),
    )
  }

  if (view) {
    return (
      <main className="min-h-screen bg-slate-950 p-6 text-white">
        <h1 className="mb-4 text-2xl font-bold">Room {view.code}</h1>
        <p className="mb-2 text-slate-400">Waiting for the host to start…</p>
        <ul className="space-y-2">
          {view.players.map((p) => (
            <li key={p.id} className={p.connected ? '' : 'text-slate-500 line-through'}>
              {p.nickname}
            </li>
          ))}
        </ul>
      </main>
    )
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-6 text-white">
      <form onSubmit={join} className="flex w-full max-w-sm flex-col gap-4">
        <h1 className="text-center text-3xl font-bold">Join a game</h1>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ROOM CODE"
          maxLength={4}
          autoCapitalize="characters"
          className="rounded-lg bg-slate-800 p-4 text-center font-mono text-2xl tracking-[0.3em]"
        />
        <input
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="Your nickname"
          maxLength={20}
          className="rounded-lg bg-slate-800 p-4 text-lg"
        />
        {error && <p className="text-center text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={code.length !== 4 || !nickname.trim()}
          className="rounded-lg bg-emerald-600 p-4 text-lg font-bold disabled:opacity-40"
        >
          Join
        </button>
      </form>
    </main>
  )
}

export default function JoinPage() {
  return (
    <Suspense>
      <JoinForm />
    </Suspense>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `pnpm --filter @hpg/web build`
Expected: build succeeds, `/join` listed in output.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/join
git commit -m "feat: phone join flow with lobby view"
```

---

### Task 10: End-to-end verification (manual)

No new files — this proves plan 1 delivers working software.

- [ ] **Step 1: Run the full test suite**

Run: `pnpm test`
Expected: all shared + game-server tests PASS.

- [ ] **Step 2: Start both apps**

Terminal 1: `pnpm dev:server` → `game-server listening on :4000`
Terminal 2: `pnpm dev:web` → Next.js on `http://localhost:3000`

- [ ] **Step 3: Walk the lobby flow**

1. Open `http://localhost:3000/host` → a 4-letter code appears.
2. Open `http://localhost:3000/join` in a second window (or your phone on the same network) → enter code + nickname → host screen shows the player pill instantly.
3. Join with a second nickname from a third window → both pills on host screen.
4. Close a player window → its pill dims/strikes through on the host within seconds.
5. Reopen `join`, same code + same nickname (same browser, so same token) → seat restored, pill lights up, still only 2 players.
6. Try a wrong code → "Room not found"; try a taken nickname from a different browser → "Nickname taken".

- [ ] **Step 4: Commit any fixes, then tag the milestone**

```bash
git commit -am "fix: lobby polish from manual verification" # only if fixes were needed
git tag plan-1-platform-foundation
```

---

## Self-review notes

- **Spec coverage (plan-1 slice):** room create/join/watch ✓, 4-letter safe-alphabet codes ✓, reconnect via localStorage token ✓, host screen stateless/reopenable (`room:watch`) ✓, 1h idle expiry ✓, in-memory only ✓, unit + socket integration tests ✓, ESLint/Prettier tooling ✓, pino structured JSON logging with event conventions ✓. Deferred to later plans per spec: engine/games, timers advancing gameplay, auth, content packs, QR code on host screen, PostHog analytics (plan 5), Playwright e2e (arrives with the first full game in plan 2).
- **Types:** `RoomView`/`JoinResult`/`WatchResult` defined once in Task 3 and imported everywhere; `RoomManager` method names consistent across Tasks 4–5.
- **No placeholders:** every code step contains the complete file.
