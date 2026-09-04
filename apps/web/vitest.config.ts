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
    env: {
      /**
       * Garde-fou : les tests unitaires **doublent Prisma**, ils ne parlent
       * jamais à une base. Un fichier qui oublie `vi.mock('@/lib/prisma')`
       * atteindrait sinon la base pointée par `.env` — c'est-à-dire la
       * production — et y écrirait pour de bon. C'est arrivé.
       *
       * Avec cette URL qui ne mène nulle part, l'oubli se solde par un échec
       * bruyant à la première requête, ce qu'on veut.
       */
      DATABASE_URL: 'postgresql://tests:tests@127.0.0.1:1/doubler-prisma',
      DIRECT_URL: 'postgresql://tests:tests@127.0.0.1:1/doubler-prisma',
    },
  },
})
