# syntax=docker/dockerfile:1
#
# Game server (Socket.IO, in-memory rooms). Runs raw TypeScript via tsx — there
# is no build step. The build CONTEXT is the repo root (this is a pnpm monorepo),
# so every path below is repo-relative. On Render this is wired via render.yaml
# (`dockerfilePath: ./apps/game-server/Dockerfile`, `dockerContext: .`).
FROM node:22-slim
ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
# corepack activates the exact pnpm version pinned in the root package.json.
RUN corepack enable
WORKDIR /app

# --- deps layer -----------------------------------------------------------
# Copy only the manifests first so `pnpm install` is cached across source-only
# changes. Every workspace package.json referenced by the lockfile must be
# present for a --frozen-lockfile install, even the ones we don't install.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json tsconfig.base.json ./
COPY packages/shared/package.json packages/shared/
COPY packages/content/package.json packages/content/
COPY apps/game-server/package.json apps/game-server/
COPY apps/web/package.json apps/web/
# Install the game-server subtree only (`...` pulls in its workspace deps),
# production dependencies only (skips vitest, typescript, pino-pretty, etc.).
RUN pnpm install --frozen-lockfile --prod --filter @hpg/game-server...

# --- source layer ---------------------------------------------------------
# Only the packages the server actually runs; apps/web is never copied in.
COPY packages/shared packages/shared
COPY packages/content packages/content
COPY apps/game-server apps/game-server

# Documentation only — Render injects $PORT and the server reads it.
EXPOSE 4000
CMD ["pnpm", "--filter", "@hpg/game-server", "start"]
