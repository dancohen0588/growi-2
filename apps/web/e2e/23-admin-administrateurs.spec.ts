import { test, expect } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { loginAs, prisma, TEST_PASSWORD } from './fixtures'

// Gestion des administrateurs, et tenue de l'admin sur un écran de téléphone.

const ADMIN_EMAIL = 'test-e2e-adm-principal@growi-garden.fr'
const SECOND_EMAIL = 'test-e2e-adm-second@growi-garden.fr'
const PLAIN_EMAIL = 'test-e2e-adm-ordinaire@growi-garden.fr'
const DISABLED_EMAIL = 'test-e2e-adm-desactive@growi-garden.fr'
const EMAILS = [ADMIN_EMAIL, SECOND_EMAIL, PLAIN_EMAIL, DISABLED_EMAIL]

async function cleanup() {
  await prisma.adminAuditLog.deleteMany({ where: { actor: { email: { in: EMAILS } } } })
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } })
}

test.beforeAll(async () => {
  await cleanup()
  const password = await bcrypt.hash(TEST_PASSWORD, 10)

  await prisma.user.create({
    data: { email: ADMIN_EMAIL, firstName: 'Principal', password, role: 'ADMIN' },
  })
  // Un second administrateur : sans lui, la garde « dernier administrateur »
  // masquerait le bouton de retrait et le parcours ne prouverait rien.
  await prisma.user.create({
    data: { email: SECOND_EMAIL, firstName: 'Second', password, role: 'ADMIN' },
  })
  await prisma.user.create({
    data: { email: PLAIN_EMAIL, firstName: 'Ordinaire', password },
  })
  await prisma.user.create({
    data: { email: DISABLED_EMAIL, firstName: 'Fermé', password, disabledAt: new Date() },
  })
})

test.afterAll(cleanup)

test.describe('Admin — administrateurs', () => {
  test('E2E-ADMIN-50 — La liste montre les administrateurs et protège l’appelant', async ({
    page,
  }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto('/admin/administrateurs')

    await expect(page.getByRole('heading', { name: 'Administrateurs' })).toBeVisible()

    const mine = page.locator('li').filter({ hasText: ADMIN_EMAIL })
    await expect(mine.getByText('Toi')).toBeVisible()
    await expect(mine.getByText('Tu ne peux pas retirer tes propres droits.')).toBeVisible()

    // L'autre administrateur, lui, est retirable.
    const other = page.locator('li').filter({ hasText: SECOND_EMAIL })
    await expect(other.getByRole('button', { name: 'Retirer les droits' })).toBeVisible()

    await page.screenshot({ path: 'test-results/admin-administrateurs.png', fullPage: true })
  })

  test('E2E-ADMIN-51 — Promouvoir un compte existant, puis le rétrograder', async ({ page }) => {
    // Ce test enchaîne connexion, promotion, relecture en base, rechargement,
    // rétrogradation : il dépasse les 30 s par défaut quand le serveur de dev
    // est chargé par la suite complète, alors qu'il passe seul sans peine.
    test.slow()

    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto('/admin/administrateurs')

    await page.fill('input[name="email"]', PLAIN_EMAIL)
    await page.getByRole('button', { name: 'Ajouter' }).click()
    await expect(page.getByRole('status').first()).toContainText('désormais administrateur', {
      timeout: 15_000,
    })

    const promoted = await prisma.user.findUniqueOrThrow({ where: { email: PLAIN_EMAIL } })
    expect(promoted.role).toBe('ADMIN')

    // La promotion est journalisée, avec son acteur.
    await expect
      .poll(() =>
        prisma.adminAuditLog.count({
          where: { action: 'admin.promote', targetId: promoted.id },
        }),
      )
      .toBe(1)

    // Puis on lui retire les droits depuis la liste.
    await page.goto('/admin/administrateurs')
    const row = page.locator('li').filter({ hasText: PLAIN_EMAIL })
    await row.getByRole('button', { name: 'Retirer les droits' }).click()
    await page.getByRole('button', { name: 'Retirer', exact: true }).click()
    await expect(page.getByRole('status').first()).toContainText('n’est plus administrateur', {
      timeout: 15_000,
    })

    await expect
      .poll(async () => (await prisma.user.findUniqueOrThrow({ where: { email: PLAIN_EMAIL } })).role)
      .toBe('USER')
  })

  test('E2E-ADMIN-52 — Les refus sont expliqués, pas silencieux', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto('/admin/administrateurs')

    // Une adresse sans compte : on ne crée personne au passage.
    await page.fill('input[name="email"]', 'personne-inconnue@growi-garden.fr')
    await page.getByRole('button', { name: 'Ajouter' }).click()
    await expect(page.getByRole('status').first()).toContainText('Aucun compte Growi', {
      timeout: 15_000,
    })

    // Un compte désactivé : des droits inexerçables n'égarent que le lecteur.
    await page.fill('input[name="email"]', DISABLED_EMAIL)
    await page.getByRole('button', { name: 'Ajouter' }).click()
    await expect(page.getByRole('status').first()).toContainText('désactivé', { timeout: 15_000 })

    expect(
      (await prisma.user.findUniqueOrThrow({ where: { email: DISABLED_EMAIL } })).role,
    ).toBe('USER')

    // Un compte déjà administrateur.
    await page.fill('input[name="email"]', SECOND_EMAIL)
    await page.getByRole('button', { name: 'Ajouter' }).click()
    await expect(page.getByRole('status').first()).toContainText('déjà administrateur', {
      timeout: 15_000,
    })
  })

  test('E2E-ADMIN-53 — L’admin reste utilisable sur un écran de téléphone', async ({ page }) => {
    // La spec l'exige : on doit pouvoir répondre à un message depuis un iPhone.
    // Quatre pages à charger après la connexion : au-delà des 30 s par défaut
    // dès que le serveur de dev est chargé par la suite complète.
    test.slow()

    await page.setViewportSize({ width: 390, height: 844 })
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)

    for (const path of ['/admin', '/admin/utilisateurs', '/admin/messages', '/admin/journal']) {
      await page.goto(path)

      // La navigation reste atteignable, et la page ne déborde pas de côté :
      // un défilement horizontal ferait sortir la nav de l'écran.
      await expect(
        page.getByRole('navigation', { name: 'Navigation administration' }),
      ).toBeVisible()

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow, `${path} déborde horizontalement`).toBeLessThanOrEqual(1)
    }

    await page.goto('/admin')
    await page.screenshot({ path: 'test-results/admin-mobile.png', fullPage: true })
  })
})
