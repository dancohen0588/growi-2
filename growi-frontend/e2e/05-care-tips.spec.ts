import { test, expect } from '@playwright/test'
import {
  loginAs,
  seedTestUser,
  seedTestPlant,
  cleanupTestData,
  prisma,
  TEST_EMAIL,
  TEST_PASSWORD,
} from './fixtures'

let gardenId: string
let userId: string
let tomatePlantId: string
let freePlantId: string

test.beforeAll(async () => {
  const data = await seedTestUser()
  userId = data.userId
  gardenId = data.gardenId!
  await prisma.plantInstance.deleteMany({ where: { gardenId } })

  const tomate = await seedTestPlant(gardenId, userId, 'Solanum lycopersicum')
  tomatePlantId = tomate.id

  const free = await seedTestPlant(gardenId, userId) // no catalog
  freePlantId = free.id
})

test.afterAll(async () => {
  await cleanupTestData()
})

test.describe('Care Tips', () => {
  test('E2E-CT-01 — careTips réels affichés pour la tomate', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto(`/dashboard/plantes/${tomatePlantId}`)
    await page.waitForLoadState('networkidle')

    const pageText = await page.textContent('body')

    // Watering tip from seed
    expect(pageText).toContain('Arrose régulièrement')
    // Pruning tip from seed
    expect(pageText).toContain('gourmands')
  })

  test('E2E-CT-02 — funFact visible', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto(`/dashboard/plantes/${tomatePlantId}`)
    await page.waitForLoadState('networkidle')

    const pageText = await page.textContent('body')
    expect(pageText).toContain('💡')
    expect(pageText).toContain('techniquement un fruit')
  })

  test('E2E-CT-03 — Sections conditionnelles absentes si vides', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto(`/dashboard/plantes/${freePlantId}`)
    await page.waitForLoadState('networkidle')

    // Optional sections should be absent
    const tailleSection = page.locator('button:has-text("Taille")')
    const maladiesSection = page.locator('button:has-text("Maladies")')
    const hiverSection = page.locator('button:has-text("Hiver")')

    expect(await tailleSection.count()).toBe(0)
    expect(await maladiesSection.count()).toBe(0)
    expect(await hiverSection.count()).toBe(0)

    // Placeholder visible
    const placeholder = page.locator("text=Données d'entretien en cours d'enrichissement")
    await expect(placeholder).toBeVisible()
  })
})
