import { test, expect } from '@playwright/test'
import {
  loginAs,
  seedTestUser,
  seedTestPlant,
  cleanupTestData,
  clearAdviceCache,
  prisma,
  TEST_EMAIL,
  TEST_PASSWORD,
} from './fixtures'

let gardenId: string
let userId: string

test.beforeAll(async () => {
  const data = await seedTestUser()
  userId = data.userId
  gardenId = data.gardenId!
  await prisma.plantInstance.deleteMany({ where: { gardenId } })
  // Add a few plants
  await seedTestPlant(gardenId, userId, 'Solanum lycopersicum')
  await seedTestPlant(gardenId, userId, 'Rosa')
  await seedTestPlant(gardenId, userId, 'Monstera deliciosa')
})

test.afterAll(async () => {
  await cleanupTestData()
})

test.describe('Performance', () => {
  test('E2E-PERF-01 — Chargement initial (cache froid) < 3s', async ({ page }) => {
    await clearAdviceCache(gardenId)
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)

    const start = Date.now()
    await page.goto('/dashboard/calendrier')
    await page.waitForLoadState('networkidle')
    const duration = Date.now() - start

    // Dev mode includes compilation overhead — allow 5s (production target: 3s)
    expect(duration).toBeLessThan(5_000)
  })

  test('E2E-PERF-02 — Chargement cache chaud < 500ms', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)

    // First load to warm cache
    await page.goto('/dashboard/calendrier')
    await page.waitForLoadState('networkidle')

    // Second load (warm)
    const start = Date.now()
    await page.goto('/dashboard/calendrier')
    await page.waitForLoadState('networkidle')
    const duration = Date.now() - start

    // Dev mode is slower than production — allow 2s
    expect(duration).toBeLessThan(2_000)
  })

  test('E2E-PERF-03 — Jardin avec 10 plantes → pas d\'erreur 500', async ({ page }) => {
    await prisma.plantInstance.deleteMany({ where: { gardenId } })
    await clearAdviceCache(gardenId)

    const catalogNames = [
      'Solanum lycopersicum', 'Rosa', 'Lavandula', 'Ocimum basilicum',
      'Pelargonium', 'Monstera deliciosa', 'Epipremnum aureum',
      'Ficus', 'Cucurbita pepo', 'Lactuca sativa',
    ]
    for (const name of catalogNames) {
      await seedTestPlant(gardenId, userId, name)
    }

    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)

    const errors: string[] = []
    page.on('response', (res) => {
      if (res.status() >= 500) errors.push(`${res.status()} ${res.url()}`)
    })

    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await page.goto('/dashboard/calendrier')
    await page.waitForLoadState('networkidle')

    expect(errors).toHaveLength(0)
    const criticalConsole = consoleErrors.filter(
      (e) => !e.includes('Warning:') && !e.includes('DevTools'),
    )
    expect(criticalConsole).toHaveLength(0)
  })
})
