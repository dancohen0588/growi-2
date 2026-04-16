import { test, expect } from '@playwright/test'
import {
  loginAs,
  seedTestUser,
  cleanupTestData,
  TEST_EMAIL,
  TEST_PASSWORD,
} from './fixtures'

let gardenId: string | null

test.beforeAll(async () => {
  const data = await seedTestUser()
  gardenId = data.gardenId
})

test.afterAll(async () => {
  await cleanupTestData()
})

test.describe('Auth', () => {
  test('E2E-AUTH-01 — Connexion valide', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text())
    })

    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    expect(page.url()).toContain('/dashboard')
    expect(consoleErrors).toHaveLength(0)
  })

  test('E2E-AUTH-02 — Accès non authentifié au calendrier', async ({ page }) => {
    await page.goto('/dashboard/calendrier')
    // Should redirect to login or show auth message
    const url = page.url()
    const hasRedirect = url.includes('/login')
    const hasAuthMessage = await page.locator('text=Connecte-toi').isVisible().catch(() => false)
    expect(hasRedirect || hasAuthMessage).toBeTruthy()
  })

  test('E2E-AUTH-03 — API sans session → 401', async ({ request }) => {
    const res = await request.get(`/api/garden/${gardenId ?? 'fake-id'}/advice`)
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Non authentifié')
  })
})
