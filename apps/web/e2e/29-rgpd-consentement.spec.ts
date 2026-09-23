import { test, expect, type Page } from '@playwright/test'

import { prisma } from './fixtures'

/**
 * RGPD / ePrivacy — spec 13, §3 et §9.
 *
 * Deux promesses à tenir :
 * 1. le site public ne dépose **rien** sur le terminal d'un visiteur — ni
 *    cookie, ni clé PostHog, ni requête d'ingestion ;
 * 2. un compte voit la question du consentement une fois, et sa réponse vaut.
 *
 * Limite assumée : en local PostHog ne démarre jamais (`analyticsEnabled` est
 * faux hors Vercel), si bien qu'un « oui » n'y produit aucune requête
 * `/ingest` ni clé `ph_`. Ce que fait l'init après un oui est couvert par
 * `lib/analytics/__tests__/client.test.ts` ; l'envoi réel, par la recette sur
 * preview (critère 3). Ici on atteste ce qui ne dépend pas de la clé : la
 * question, l'écriture en base, l'absence de tout dépôt avant et après.
 */

const PREFIX = 'e2e-rgpd-'
const PASSWORD = 'Rgpd-E2E-2026!'
const DIALOG_NAME = 'Aider à améliorer Growi ?'

function newEmail(label: string) {
  return `${PREFIX}${label}-${Date.now()}@growi-garden.fr`
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
}

test.beforeAll(cleanup)
test.afterAll(cleanup)

/** Toute requête vers l'ingestion PostHog, relevée pour la durée du test. */
function watchIngest(page: Page): string[] {
  const hits: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (url.includes('/ingest') || url.includes('posthog.com')) hits.push(url)
  })
  return hits
}

async function postHogKeys(page: Page): Promise<string[]> {
  return page.evaluate(() => Object.keys(window.localStorage).filter((k) => k.startsWith('ph_')))
}

async function register(page: Page, email: string) {
  await page.goto('/register')
  await page.fill('#firstName', 'Rgpd')
  await page.fill('#reg-email', email)
  await page.fill('#reg-password', PASSWORD)
  await page.fill('#confirm', PASSWORD)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard**', { timeout: 60_000 })
}

async function consentOf(email: string) {
  return prisma.user.findUniqueOrThrow({
    where: { email },
    select: { analyticsConsent: true, analyticsConsentAt: true, termsAcceptedAt: true, termsVersion: true },
  })
}

test.describe('RGPD — rien sur le site public', () => {
  for (const path of ['/', '/fonctionnalites', '/identifier', '/blog']) {
    test(`E2E-RGPD-01 — ${path} : ni cookie, ni clé ph_, ni ingestion`, async ({ page, context }) => {
      test.slow() // Compilation à froid des pages en `next dev`.
      const ingest = watchIngest(page)

      await page.goto(path, { waitUntil: 'networkidle' })

      // NextAuth pose ses cookies techniques (`authjs.csrf-token`,
      // `authjs.callback-url`) dès que l'en-tête lit la session : nécessaires
      // à l'authentification, exemptés de consentement, et `httpOnly`. Rien
      // d'autre n'a à apparaître.
      const cookies = await context.cookies()
      expect(cookies.filter((c) => !c.name.startsWith('authjs.'))).toEqual([])
      expect(await page.evaluate(() => document.cookie)).toBe('')
      expect(await postHogKeys(page)).toEqual([])
      expect(ingest).toEqual([])
    })
  }
})

test.describe('RGPD — question du consentement', () => {
  test('E2E-RGPD-02 — « Non merci » : rien ne part, la question ne revient pas', async ({ page }) => {
    test.slow()
    const email = newEmail('non')
    const ingest = watchIngest(page)

    await register(page, email)

    const dialog = page.getByRole('dialog', { name: DIALOG_NAME })
    await expect(dialog).toBeVisible()
    // Non fermable sans réponse.
    await page.keyboard.press('Escape')
    await expect(dialog).toBeVisible()

    await dialog.getByRole('button', { name: 'Non merci' }).click()
    // Premier appel à `/api/user/profile` : compilé à froid par `next dev`.
    await expect(dialog).toBeHidden({ timeout: 30_000 })

    const stored = await consentOf(email)
    expect(stored.analyticsConsent).toBe(false)
    expect(stored.analyticsConsentAt).not.toBeNull()
    // L'inscription a tracé l'acceptation des CGU.
    expect(stored.termsAcceptedAt).not.toBeNull()
    expect(stored.termsVersion).toBeTruthy()

    await page.reload()
    await expect(page.getByRole('dialog', { name: DIALOG_NAME })).toHaveCount(0)
    expect(await postHogKeys(page)).toEqual([])
    expect(ingest).toEqual([])
  })

  test("E2E-RGPD-03 — « Oui, j'aide » : le choix est écrit, sans cookie ph_", async ({
    page,
    context,
  }) => {
    test.slow()
    const email = newEmail('oui')

    await register(page, email)

    const dialog = page.getByRole('dialog', { name: DIALOG_NAME })
    await dialog.getByRole('button', { name: "Oui, j'aide" }).click()
    await expect(dialog).toBeHidden({ timeout: 30_000 })

    expect((await consentOf(email)).analyticsConsent).toBe(true)

    await page.reload()
    await expect(page.getByRole('dialog', { name: DIALOG_NAME })).toHaveCount(0)
    const cookies = await context.cookies()
    expect(cookies.filter((c) => c.name.startsWith('ph_'))).toEqual([])
  })

  test('E2E-RGPD-04 — L’interrupteur de Confidentialité reflète le choix et le retire', async ({
    page,
  }) => {
    test.slow()
    const email = newEmail('interrupteur')

    await register(page, email)
    const dialog = page.getByRole('dialog', { name: DIALOG_NAME })
    await dialog.getByRole('button', { name: "Oui, j'aide" }).click()
    // Fermée = écrite : quitter la page avant couperait la requête en route.
    await expect(dialog).toBeHidden({ timeout: 30_000 })

    await page.goto('/dashboard/compte#confidentialite')
    const toggle = page.getByRole('switch', { name: /Aider à améliorer Growi/ })
    await expect(toggle).toHaveAttribute('aria-checked', 'true')

    await toggle.click()
    await expect(toggle).toHaveAttribute('aria-checked', 'false')
    await expect.poll(async () => (await consentOf(email)).analyticsConsent).toBe(false)
    expect(await postHogKeys(page)).toEqual([])
  })
})
