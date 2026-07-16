import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

/**
 * Vitest config for @hpg/web. The React plugin provides the JSX transform
 * for component tests; the alias mirrors tsconfig's `@/*` paths; jsdom is
 * opted into per-file with a `@vitest-environment jsdom` comment so pure
 * lib tests stay in node. Globals are enabled so @testing-library/react
 * registers its auto-cleanup `afterEach` and unmounts between tests.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: { globals: true },
})
