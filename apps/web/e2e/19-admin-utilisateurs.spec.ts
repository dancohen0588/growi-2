import { test, expect } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { loginAs, prisma, TEST_PASSWORD } from './fixtures'

// Liste des utilisateurs, filtres, export CSV et journal d'audit.

const ADMIN_EMAIL = 'test-e2e-admin-liste@growi-garden.fr'
const TARGET_EMAIL = 'test-e2e-cible-liste@growi-garden.fr'
const EMAILS = [ADMIN_EMAIL, TARGET_EMAIL]

async function seedAccount(email: string, role: 'USER' | 'ADMIN', extra = {}) {
  const password = await bcrypt.hash(TEST_PASSWORD, 10)
  return prisma.user.upsert({
    where: { email },
    create: { email, firstName: 'Liste', lastName: 'E2E', password, role, ...extra },
    update: { password, role, disabledAt: null, ...extra },
  })
}

async function cleanup() {
  await prisma.adminAuditLog.deleteMany({ where: { actor: { email: { in: EMAILS } } } })
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } })
}

test.beforeAll(async () => {
  await cleanup()
  await seedAccount(ADMIN_EMAIL, 'ADMIN')
  await seedAccount(TARGET_EMAIL, 'USER', { locationCity: 'Bordeaux', onboarded: true })
})

test.afterAll(cleanup)

test.describe('Admin — utilisateurs et journal', () => {
  test('E2E-ADMIN-10 — La liste affiche les comptes et se filtre par l’URL', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)

    await page.goto('/admin/utilisateurs')
    await expect(page.getByRole('heading', { name: 'Utilisateurs' })).toBeVisible()

    // Les assertions portent sur le **tableau**, pas sur la page : l'en-tête du
    // layout affiche en permanence l'email de l'administrateur connecté, ce qui
    // rendrait toute vérification d'absence trompeuse.
    const table = page.locator('table')
    await expect(table.getByText(TARGET_EMAIL)).toBeVisible()

    await page.screenshot({ path: 'test-results/admin-utilisateurs.png', fullPage: true })

    // Le filtre vit dans l'URL : la vue est donc partageable et « précédent »
    // la défait.
    await page.goto(`/admin/utilisateurs?q=${encodeURIComponent(TARGET_EMAIL)}`)
    await expect(table.getByText(TARGET_EMAIL)).toBeVisible()
    await expect(table.getByText(ADMIN_EMAIL)).toHaveCount(0)

    // Un filtre qui ne ramène rien donne un état vide, pas une erreur.
    await page.goto('/admin/utilisateurs?q=zzz-personne-zzz')
    await expect(page.getByText('Aucun compte ne correspond')).toBeVisible()
  })

  test('E2E-ADMIN-11 — Une URL malformée ne casse pas la page', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)

    await page.goto('/admin/utilisateurs?apres=nimportequoi&role=SUPERADMIN&inscrit_depuis=hier')
    await expect(page.getByRole('heading', { name: 'Utilisateurs' })).toBeVisible()
  })

  test('E2E-ADMIN-12 — L’export CSV télécharge et se journalise', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)

    const res = await page.request.get(
      `/admin/utilisateurs/export?q=${encodeURIComponent(TARGET_EMAIL)}`,
    )
    expect(res.status()).toBe(200)
    expect(res.headers()['content-type']).toContain('text/csv')
    expect(res.headers()['content-disposition']).toContain('attachment')
    // Données personnelles : rien ne doit les mettre en cache.
    expect(res.headers()['cache-control']).toContain('no-store')

    const body = await res.text()
    expect(body.startsWith('﻿')).toBe(true) // BOM, sinon Excel casse les accents
    expect(body).toContain('Email;Nom;')
    expect(body).toContain(TARGET_EMAIL)

    // L'export sort des données du produit : il laisse une trace.
    await expect
      .poll(() =>
        prisma.adminAuditLog.count({
          where: { action: 'user.export', actor: { email: ADMIN_EMAIL } },
        }),
      )
      .toBeGreaterThan(0)
  })

  test('E2E-ADMIN-13 — Le journal affiche l’action et sa cible', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)

    // On provoque une entrée par l'export, puis on la relit dans l'écran.
    await page.request.get('/admin/utilisateurs/export')

    await page.goto('/admin/journal')
    await expect(page.getByRole('heading', { name: 'Journal' })).toBeVisible()
    const table = page.locator('table')
    await expect(
      table.getByText('Export CSV de la liste des utilisateurs').first(),
    ).toBeVisible()
    // Dans le tableau, donc bien comme acteur de l'action — et non dans
    // l'en-tête, où il figure de toute façon.
    await expect(table.getByText(ADMIN_EMAIL).first()).toBeVisible()

    await page.screenshot({ path: 'test-results/admin-journal.png', fullPage: true })

    // Filtre par action, toujours par l'URL.
    await page.goto('/admin/journal?action=contact.reply')
    await expect(page.getByText('Aucune action journalisée')).toBeVisible()
  })

  test('E2E-ADMIN-14 — Un compte ordinaire n’atteint ni la liste ni l’export', async ({ page }) => {
    await loginAs(page, TARGET_EMAIL, TEST_PASSWORD)

    await page.goto('/admin/utilisateurs')
    await page.waitForURL('**/dashboard**', { timeout: 15_000 })

    // La route d'export est un point d'entrée à part : elle refait le contrôle.
    const res = await page.request.get('/admin/utilisateurs/export')
    expect(res.status()).toBe(403)
  })
})
