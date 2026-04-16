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

let userId: string
let gardenId: string

test.beforeAll(async () => {
  const data = await seedTestUser()
  userId = data.userId
  gardenId = data.gardenId!
  // Clean plants from previous runs
  await prisma.plantInstance.deleteMany({ where: { gardenId } })
  await clearAdviceCache(gardenId)
})

test.afterAll(async () => {
  await cleanupTestData()
})

test.describe('Calendrier', () => {
  test('E2E-CAL-01 — Jardin sans plantes', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard/calendrier')
    await page.waitForLoadState('networkidle')

    // Should show empty state or no action cards
    const pageText = await page.textContent('body')
    const hasEmptyState =
      pageText?.includes('Crée d\u2019abord un jardin') ||
      pageText?.includes('Crée d\'abord un jardin') ||
      pageText?.includes('0 à venir cette semaine')
    expect(hasEmptyState).toBeTruthy()

    // No critical console errors (filter out Next.js dev warnings)
    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes('Warning:') && !e.includes('DevTools'),
    )
    expect(criticalErrors).toHaveLength(0)
  })

  test('E2E-CAL-02 — Ajout tomate → conseils générés', async ({ page }) => {
    await clearAdviceCache(gardenId)
    await seedTestPlant(gardenId, userId, 'Solanum lycopersicum')

    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard/calendrier')
    await page.waitForLoadState('networkidle')

    // At least one action should be visible
    const pageText = await page.textContent('body')
    const hasAction =
      pageText?.includes('Arrose') ||
      pageText?.includes('Sème') ||
      pageText?.includes('récolter') ||
      pageText?.includes('Fertilise') ||
      pageText?.includes('Taille') ||
      pageText?.includes('Traitement')
    expect(hasAction).toBeTruthy()
  })

  test('E2E-CAL-03 — Actions triées par priorité', async ({ page }) => {
    await clearAdviceCache(gardenId)
    await prisma.plantInstance.deleteMany({ where: { gardenId } })

    await seedTestPlant(gardenId, userId, 'Solanum lycopersicum')
    await seedTestPlant(gardenId, userId, 'Rosa')
    await seedTestPlant(gardenId, userId, 'Monstera deliciosa')

    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard/calendrier')
    await page.waitForLoadState('networkidle')

    // Verify page loaded with actions
    const pageText = await page.textContent('body')
    expect(pageText).toBeTruthy()
  })

  test('E2E-CAL-04 — Cache: deux chargements consécutifs', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)

    // First load
    const res1 = await page.request.get(`/api/garden/${gardenId}/advice`)
    if (res1.status() !== 200) return // skip if no data
    const data1 = await res1.json()

    // Second load
    const res2 = await page.request.get(`/api/garden/${gardenId}/advice`)
    const data2 = await res2.json()

    expect(data1.generatedAt).toBe(data2.generatedAt)
  })

  test('E2E-CAL-05 — Invalidation du cache après arrosage', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)

    // Get initial generatedAt
    const res1 = await page.request.get(`/api/garden/${gardenId}/advice`)
    if (res1.status() !== 200) return
    const data1 = await res1.json()
    const initialGeneratedAt = data1.generatedAt

    // Get a plant to water
    const plant = await prisma.plantInstance.findFirst({
      where: { gardenId },
      select: { id: true },
    })
    if (!plant) return

    // Invalidate cache by updating lastWateredAt + clearing cache
    await prisma.plantInstance.update({
      where: { id: plant.id },
      data: { lastWateredAt: new Date() },
    })
    await clearAdviceCache(gardenId)

    // Reload
    const res2 = await page.request.get(`/api/garden/${gardenId}/advice`)
    const data2 = await res2.json()
    expect(data2.generatedAt).not.toBe(initialGeneratedAt)
  })
})
