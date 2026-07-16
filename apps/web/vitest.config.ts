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
