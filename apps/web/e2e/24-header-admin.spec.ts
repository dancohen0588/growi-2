import { test, expect } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { loginAs, prisma, TEST_PASSWORD } from './fixtures'

/**
 * Lien « Admin » du header public.
 *
 * L'enjeu n'est pas l'affichage mais la **source** du rôle : le header lit
 * `/api/admin/status`, qui relit la base, et non `session.user.role`, figé dans
 * le JWT à la connexion. Un compte promu en cours de session doit voir le lien
 * apparaître sans se reconnecter — c'est ce que vérifie E2E-HEADER-03.
 */

const ADMIN_EMAIL = 'test-e2e-header-admin@growi-garden.fr'
const USER_EMAIL = 'test-e2e-header-user@growi-garden.fr'
const EMAILS = [ADMIN_EMAIL, USER_EMAIL]

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } })
}

test.beforeAll(async () => {
  await cleanup()
  const password = await bcrypt.hash(TEST_PASSWORD, 10)

  await prisma.user.create({
    data: { email: ADMIN_EMAIL, firstName: 'Header', password, role: 'ADMIN' },
  })
  await prisma.user.create({
    data: { email: USER_EMAIL, firstName: 'Header', password },
  })
})

test.afterAll(cleanup)

/** Le lien tel qu'il apparaît dans la navigation principale du site public. */
const adminLink = (page: import('@playwright/test').Page) =>
  page
    .getByRole('navigation', { name: 'Navigation principale' })
    .getByRole('link', { name: 'Admin' })

test.describe('Header — lien Admin', () => {
  test('E2E-HEADER-01 — Un administrateur le voit, après Contact', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto('/')

    await expect(adminLink(page)).toBeVisible({ timeout: 15_000 })
    await expect(adminLink(page)).toHaveAttribute('href', '/admin')

    // Il suit « Contact » : l'ordre du DOM fait foi dans une nav en ligne.
    const labels = await page
      .getByRole('navigation', { name: 'Navigation principale' })
      .getByRole('link')
      .allInnerTexts()
    expect(labels.at(-1)?.trim()).toBe('Admin')
    expect(labels.at(-2)?.trim()).toBe('Contact')

    await page.screenshot({ path: 'test-results/header-admin.png' })
  })

  test('E2E-HEADER-02 — Un compte ordinaire ne le voit pas', async ({ page }) => {
    await loginAs(page, USER_EMAIL, TEST_PASSWORD)
    await page.goto('/')

    // On attend que la page soit établie avant de conclure à une absence,
    // sinon on constaterait seulement qu'elle n'a pas fini de charger.
    await expect(page.getByRole('link', { name: 'Tableau de bord' }).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(adminLink(page)).toHaveCount(0)

    // Et la route qui décide répond bien non.
    const res = await page.request.get('/api/admin/status')
    expect(await res.json()).toEqual({ isAdmin: false })
  })

  test('E2E-HEADER-03 — Une promotion en cours de session suffit', async ({ page }) => {
    await loginAs(page, USER_EMAIL, TEST_PASSWORD)
    await page.goto('/')
    await expect(adminLink(page)).toHaveCount(0)

    // Le JWT du navigateur dit toujours « USER » ; la base, elle, a changé.
    await prisma.user.update({ where: { email: USER_EMAIL }, data: { role: 'ADMIN' } })

    await page.reload()
    await expect(adminLink(page)).toBeVisible({ timeout: 15_000 })

    // Et la rétrogradation le retire tout aussi vite.
    await prisma.user.update({ where: { email: USER_EMAIL }, data: { role: 'USER' } })
    await page.reload()
    await expect(adminLink(page)).toHaveCount(0)
  })

  test('E2E-HEADER-04 — Un visiteur anonyme ne le voit pas', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByRole('link', { name: 'Connexion' }).first()).toBeVisible({
      timeout: 15_000,
    })
    await expect(adminLink(page)).toHaveCount(0)

    const res = await page.request.get('/api/admin/status')
    expect(await res.json()).toEqual({ isAdmin: false })
  })
})
