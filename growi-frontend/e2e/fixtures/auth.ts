import type { Page } from '@playwright/test'

export async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.fill('#email', email)
  await page.fill('#password', password)
  await page.click('button[type="submit"]')
  // Wait for either dashboard redirect or the page to settle
  await page.waitForURL('**/dashboard**', { timeout: 30_000 }).catch(async () => {
    // Sometimes next-auth redirect is slow — retry
    await page.waitForTimeout(2_000)
  })
}

export async function logout(page: Page) {
  await page.goto('/api/auth/signout', { waitUntil: 'networkidle' })
}
