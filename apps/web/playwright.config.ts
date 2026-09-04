import { defineConfig, devices } from '@playwright/test'

/**
 * Port du serveur de test.
 *
 * 3000 par défaut, comme avant. `E2E_PORT` permet de faire tourner la suite à
 * côté d'un `next dev` déjà lancé — ce qui n'est pas qu'un confort : avec
 * `reuseExistingServer`, Playwright s'attache au serveur en place, et un
 * serveur démarré avant une migration porte un client Prisma périmé qui fait
 * échouer les tests pour une raison sans rapport avec le code.
 */
const PORT = Number(process.env.E2E_PORT ?? 3000)
const BASE_URL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: 1,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
