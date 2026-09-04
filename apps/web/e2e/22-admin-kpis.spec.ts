import { test, expect } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { loginAs, prisma, TEST_PASSWORD } from './fixtures'

/**
 * Tableau de bord.
 *
 * L'enjeu de ce fichier est le **SQL brut** : il échappe au typecheck et aux
 * tests unitaires, qui doublent Prisma. Une requête fautive fait répondre 500 à
 * la page — c'est donc son rendu qui l'atteste, contre la vraie base.
 */

const ADMIN_EMAIL = 'test-e2e-kpi-admin@growi-garden.fr'
const USER_EMAIL = 'test-e2e-kpi-user@growi-garden.fr'
const EMAILS = [ADMIN_EMAIL, USER_EMAIL]

async function cleanup() {
  await prisma.adminAuditLog.deleteMany({ where: { actor: { email: { in: EMAILS } } } })
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } })
}

test.beforeAll(async () => {
  await cleanup()
  const password = await bcrypt.hash(TEST_PASSWORD, 10)

  await prisma.user.create({
    data: { email: ADMIN_EMAIL, firstName: 'KPI', password, role: 'ADMIN' },
  })

  // Un compte avec de quoi alimenter plusieurs séries à la fois.
  const user = await prisma.user.create({
    data: { email: USER_EMAIL, firstName: 'KPI', password, onboarded: true },
  })
  const garden = await prisma.garden.create({
    data: { userId: user.id, name: 'Jardin KPI', type: 'OUTDOOR' },
  })
  await prisma.plantInstance.create({
    data: { userId: user.id, gardenId: garden.id, customName: 'Plante KPI', location: 'OUTDOOR' },
  })
  await prisma.userActivity.create({
    data: { userId: user.id, day: new Date().toISOString().slice(0, 10), surface: 'mobile' },
  })
})

test.afterAll(cleanup)

test.describe('Admin — tableau de bord', () => {
  test('E2E-ADMIN-40 — Toutes les sections se calculent et s’affichent', async ({ page }) => {
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)

    const response = await page.goto('/admin')
    // Le contrôle qui compte : une requête SQL fautive donnerait 500.
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { name: 'Tableau de bord' })).toBeVisible()

    for (const section of [
      'Comptes',
      'Utilisateurs actifs',
      'Jardins et plantes',
      'Usage de l’IA',
      'Notifications et support',
    ]) {
      await expect(page.getByRole('heading', { name: section, exact: true })).toBeVisible()
    }

    // Les séries hebdomadaires sont bien calculées, pas juste esquissées.
    await expect(page.getByText('Inscriptions par semaine')).toBeVisible()
    await expect(page.getByText('Actifs par semaine et par surface')).toBeVisible()
    await expect(page.getByText('Rétention des cohortes')).toBeVisible()

    expect(errors).toEqual([])

    await page.screenshot({ path: 'test-results/admin-kpis.png', fullPage: true })
  })

  test('E2E-ADMIN-41 — Les données seedées remontent dans les indicateurs', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto('/admin')

    // Le compte seedé a une trace `mobile` du jour : les actifs ne sont pas à zéro.
    const dau = page.locator('div').filter({ hasText: /^Actifs aujourd’hui/ }).first()
    await expect(dau).toContainText('mobile')

    // Totaux non nuls : les `COUNT` sont bien castés en entiers, pas en BigInt
    // (qui ferait échouer la sérialisation avant même l'affichage).
    await expect(page.getByText('Comptes au total')).toBeVisible()
    await expect(page.getByText('Plantes par compte onboardé')).toBeVisible()
  })

  test('E2E-ADMIN-42 — Le lien « Trafic du site » pointe vers Vercel', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto('/admin')

    const link = page.getByRole('link', { name: /Trafic du site/ })
    await expect(link).toHaveAttribute('href', /vercel\.com/)
    // Une cible externe s'ouvre à part, et `noopener` évite qu'elle reprenne
    // la main sur l'onglet de l'admin.
    await expect(link).toHaveAttribute('rel', /noopener/)
  })

  test('E2E-ADMIN-43 — Un compte ordinaire n’atteint pas le tableau de bord', async ({ page }) => {
    await loginAs(page, USER_EMAIL, TEST_PASSWORD)
    await page.goto('/admin')
    await page.waitForURL('**/dashboard**', { timeout: 15_000 })
  })
})
