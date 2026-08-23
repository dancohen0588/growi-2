import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
      // `server-only` lève à l'import hors environnement React Server.
      'server-only': path.resolve(__dirname, 'lib/__tests__/stubs/server-only.ts'),
    },
  },
  // Next met `jsx: 'preserve'` dans tsconfig et transforme lui-même ; Vitest,
  // lui, a besoin qu'on lui dise quoi faire du JSX (composants MDX du blog).
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    globals: true,
    exclude: ['e2e/**', 'node_modules/**'],
  },
})
