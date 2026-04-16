import { test, expect } from '@playwright/test'
import {
  loginAs,
  seedTestUser,
  seedTestUser2,
  cleanupTestData,
  TEST_EMAIL,
  TEST_PASSWORD,
} from './fixtures'

let gardenId1: string | null
let gardenId2: string | null

test.beforeAll(async () => {
  const data1 = await seedTestUser()
  gardenId1 = data1.gardenId
  const data2 = await seedTestUser2()
  gardenId2 = data2.gardenId
})

test.afterAll(async () => {
  await cleanupTestData()
})

test.describe('Security', () => {
  test('E2E-SEC-01 — Isolation entre utilisateurs', async ({ page }) => {
    // Login as user 1
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)

    // Try to access user 2's garden advice
    const res = await page.request.get(`/api/garden/${gardenId2}/advice`)
    expect(res.status()).toBe(403)
  })

  test('E2E-SEC-02 — API sans authentification → 401', async ({ request }) => {
    const res = await request.get(`/api/garden/${gardenId1}/advice`)
    expect(res.status()).toBe(401)
    const body = await res.json()
    expect(body.error).toBe('Non authentifié')
  })
})
