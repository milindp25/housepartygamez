import { defineConfig } from '@playwright/test'

/**
 * Playwright config for the WYR happy-path e2e. Starts both dev servers
 * (game-server on :4000, next on :3000) if they aren't already up; reuses
 * running instances during interactive development so a live dev session
 * isn't restarted for every run.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: { baseURL: 'http://localhost:3000' },
  webServer: [
    {
      command: 'pnpm --filter @hpg/game-server dev',
      port: 4000,
      reuseExistingServer: true,
      cwd: '../..',
    },
    {
      command: 'pnpm --filter @hpg/web dev',
      port: 3000,
      reuseExistingServer: true,
      cwd: '../..',
    },
  ],
})
