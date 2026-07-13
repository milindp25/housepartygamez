# Implementation plans — execution playbook

**Spec:** `docs/superpowers/specs/2026-07-13-housepartygamez-design.md`
**Workflow:** plans are authored + reviewed by Claude Fable; implemented by Claude Opus/Sonnet in separate sessions using subagent-driven development.

## The plans, in order

| # | Plan file | Delivers | Depends on |
|---|---|---|---|
| 1 | `2026-07-13-platform-foundation.md` | Monorepo, rooms, lobby on TV + phones | — |
| 2 | `2026-07-13-plan-2-engine-would-you-rather.md` | Round engine + Would You Rather end-to-end + Playwright e2e | plan 1 |
| 3 | `2026-07-13-plan-3-remaining-games.md` | Most Likely To, Never Have I Ever, Who Said That | plan 2 |
| 4 | `2026-07-13-plan-4-auth-custom-packs.md` | Google sign-in, Postgres, custom question packs | plan 2 (3 recommended) |
| 5 | `2026-07-13-plan-5-launch.md` | CI, deploy, landing/SEO pages, PostHog analytics, QR codes, content expansion | all prior |

## How to execute a plan (one fresh window per plan)

1. Open a new Claude Code session in this repo (Opus or Sonnet).
2. Prompt:
   > Execute `docs/superpowers/plans/<plan-file>` using the superpowers:subagent-driven-development skill. Work task by task, check off the `- [ ]` boxes in the plan file as you complete steps, follow the TDD steps exactly, and obey the Standards block at the top of the plan. Stop and report if the repo state contradicts the plan.
3. When the session reports completion, verify the milestone tag exists (each plan's final task creates one, e.g. `plan-2-would-you-rather`).

## Pre-flight rule (executors: read this)

Every plan was written before its predecessors were executed. Before starting plan N:

- Confirm plan N−1's final task is checked off and its milestone tag exists, and `pnpm test` + `pnpm lint` pass.
- The plan's code blocks are **normative for intent and public signatures**. If the actual repo differs mechanically (import paths, versions, generated scaffold details), follow the repo and keep the plan's intent — then note the deviation at the bottom of the plan file under a `## Deviations` heading.
- Never silently skip a step. If a step is impossible as written, stop and record why in `## Deviations`.

## Review protocol (after each plan)

Return to the Fable session (or start one) and prompt:

> Plan N (`<plan-file>`) was implemented by another session. Review the implementation: (1) diff since the previous milestone tag, (2) check every plan task is done and every spec requirement in scope is met, (3) run the full test suite and the plan's manual verification steps, (4) check the Standards block was followed (JSDoc, lint, pino JSON logging conventions), (5) read `## Deviations` and judge each one. Report findings before anything is merged/tagged as reviewed.

Fixes coming out of review are applied in the review session (small) or spun into a follow-up task list (large).

## Standards (apply to every plan, every task)

- TypeScript strict; `pnpm lint` (ESLint + Prettier) must pass before each commit.
- JSDoc on every exported function/class/type; inline comments explain *why*, not *what*.
- Game-server logging: pino structured JSON — `event` name (snake_case) + context fields (`roomCode`, `playerId`, `socketId`). `info` lifecycle, `warn` rejected client actions, `error` exceptions.
- TDD wherever there is logic: failing test → run → implement → run → commit.
- Game rules live in pure functions (`packages/shared`); sockets and timers stay in `apps/game-server`; pages are dumb renderers.
