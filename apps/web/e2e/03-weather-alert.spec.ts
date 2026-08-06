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

function mockCachePayload(gardenId: string, alerts: unknown[]) {
  return {
    gardenId,
    generatedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 6 * 3600_000).toISOString(),
    actions: [],
    adviceByPlant: [],
    alerts,
  }
}

async function injectCacheWithAlerts(gardenId: string, alerts: unknown[]) {
  await prisma.gardenAdviceCache.upsert({
    where: { gardenId },
    create: {
      gardenId,
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 6 * 3600_000),
      payload: mockCachePayload(gardenId, alerts) as any,
    },
    update: {
      generatedAt: new Date(),
      expiresAt: new Date(Date.now() + 6 * 3600_000),
      payload: mockCachePayload(gardenId, alerts) as any,
    },
  })
}

test.beforeAll(async () => {
  const data = await seedTestUser()
  userId = data.userId
  gardenId = data.gardenId!
  await prisma.plantInstance.deleteMany({ where: { gardenId } })
  await seedTestPlant(gardenId, userId, 'Solanum lycopersicum')
})

test.afterAll(async () => {
  await cleanupTestData()
})

const BANNER = '[data-testid="weather-alert-banner"]'

test.describe('Weather Alert Banner', () => {
  test('E2E-WA-01 — Banner gel visible si alerte présente', async ({ page }) => {
    await injectCacheWithAlerts(gardenId, [
      {
        id: 'alert-gel-1',
        type: 'gel',
        severity: 'high',
        message: 'Gel prévu — protège Tomate',
        plantInstanceId: 'p1',
      },
    ])

    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard/calendrier')
    await page.waitForLoadState('networkidle')

    const banner = page.locator(BANNER)
    await expect(banner).toBeVisible()
    const text = await banner.textContent()
    expect(text).toContain('Gel')
  })

  test('E2E-WA-02 — Groupement de plusieurs alertes gel', async ({ page }) => {
    await injectCacheWithAlerts(gardenId, [
      { id: 'a1', type: 'gel', severity: 'high', message: 'Gel prévu — protège Tomate', plantInstanceId: 'p1' },
      { id: 'a2', type: 'gel', severity: 'high', message: 'Gel prévu — protège Rosier', plantInstanceId: 'p2' },
      { id: 'a3', type: 'gel', severity: 'high', message: 'Gel prévu — protège Basilic', plantInstanceId: 'p3' },
    ])

    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard/calendrier')
    await page.waitForLoadState('networkidle')

    const banner = page.locator(BANNER)
    await expect(banner).toBeVisible()
    const text = await banner.textContent()
    expect(text).toContain('3 plantes concernées')
  })

  test('E2E-WA-03 — Dismiss du banner', async ({ page }) => {
    await injectCacheWithAlerts(gardenId, [
      { id: 'a1', type: 'gel', severity: 'high', message: 'Gel prévu', plantInstanceId: 'p1' },
    ])

    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard/calendrier')
    await page.waitForLoadState('networkidle')

    const banner = page.locator(BANNER)
    await expect(banner).toBeVisible()

    await page.click('[aria-label="Fermer les alertes"]')
    await expect(banner).toBeHidden()
  })

  test('E2E-WA-04 — Aucune alerte → banner absent', async ({ page }) => {
    await injectCacheWithAlerts(gardenId, [])

    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard/calendrier')
    await page.waitForLoadState('networkidle')

    const banner = page.locator(BANNER)
    await expect(banner).toHaveCount(0)
  })
})
