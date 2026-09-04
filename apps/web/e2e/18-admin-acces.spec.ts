import { test, expect } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { loginAs, prisma, TEST_PASSWORD } from './fixtures'

// Contrôle d'accès du portail d'administration : qui entre, qui est renvoyé.
// C'est le seul endroit de la suite où le rôle décide de quelque chose.

const USER_EMAIL = 'test-e2e-admin-user@growi-garden.fr'
const ADMIN_EMAIL = 'test-e2e-admin@growi-garden.fr'
/**
 * Compte réservé au test de la trace d'activité. Il lui faut un porteur que
 * l'étranglement de `touchActivity` n'a jamais vu : ce cache vit dans le
 * process du serveur de dev, qui survit d'un test à l'autre. Réutiliser un
 * compte déjà connecté ferait échouer le test sans que le code soit en cause.
 */
const ACTIVITY_EMAIL = 'test-e2e-admin-activite@growi-garden.fr'

const ALL_EMAILS = [USER_EMAIL, ADMIN_EMAIL, ACTIVITY_EMAIL]

async function seedAccount(email: string, role: 'USER' | 'ADMIN') {
  const password = await bcrypt.hash(TEST_PASSWORD, 10)
  return prisma.user.upsert({
    where: { email },
    create: { email, name: 'E2E Admin', firstName: 'E2E', password, role, onboarded: true },
    update: { password, role, disabledAt: null },
  })
}

async function cleanup() {
  await prisma.user.deleteMany({ where: { email: { in: ALL_EMAILS } } })
}

test.beforeAll(async () => {
  await cleanup()
  await seedAccount(USER_EMAIL, 'USER')
  await seedAccount(ADMIN_EMAIL, 'ADMIN')
  await seedAccount(ACTIVITY_EMAIL, 'USER')
})

test.afterAll(cleanup)

test.describe('Portail admin — accès', () => {
  test('E2E-ADMIN-01 — Anonyme : /admin renvoie vers la connexion', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForURL('**/login**', { timeout: 15_000 })
    expect(page.url()).toContain('/login')
  })

  test('E2E-ADMIN-02 — Compte ordinaire : renvoyé au dashboard', async ({ page }) => {
    await loginAs(page, USER_EMAIL, TEST_PASSWORD)

    await page.goto('/admin')
    await page.waitForURL('**/dashboard**', { timeout: 15_000 })
    expect(page.url()).toContain('/dashboard')
    expect(page.url()).not.toContain('/admin')
  })

  test('E2E-ADMIN-03 — Administrateur : /admin s’affiche', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)

    await page.goto('/admin')
    await expect(page.getByText('Admin Growi')).toBeVisible({ timeout: 15_000 })
    expect(page.url()).toContain('/admin')
  })

  test('E2E-ADMIN-06 — Promotion en cours de session : accès immédiat', async ({ page }) => {
    // Le cas rencontré en vrai : on se connecte, *puis* on est promu. Le JWT
    // du navigateur porte encore `USER`. Si le middleware jugeait sur ce
    // jeton, le compte resterait dehors jusqu'à sa prochaine connexion —
    // sans aucun moyen de s'en douter.
    const email = 'test-e2e-admin-promu@growi-garden.fr'
    await seedAccount(email, 'USER')

    try {
      await loginAs(page, email, TEST_PASSWORD)

      await page.goto('/admin')
      await page.waitForURL('**/dashboard**', { timeout: 15_000 })

      await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } })

      // Même session, même cookie, aucune reconnexion.
      await page.goto('/admin')
      await expect(page.getByText('Admin Growi')).toBeVisible({ timeout: 15_000 })
      expect(page.url()).toContain('/admin')

      // Et la rétrogradation referme la porte, tout aussi vite.
      await prisma.user.update({ where: { email }, data: { role: 'USER' } })
      await page.goto('/admin')
      await page.waitForURL('**/dashboard**', { timeout: 15_000 })
    } finally {
      await prisma.user.deleteMany({ where: { email } })
    }
  })

  test('E2E-ADMIN-04 — Compte désactivé : connexion refusée', async ({ page }) => {
    await prisma.user.update({
      where: { email: USER_EMAIL },
      data: { disabledAt: new Date() },
    })

    try {
      // `loginAs` attend le dashboard pendant 30 s : elle est faite pour les
      // connexions qui aboutissent. Ici on attend précisément l'inverse.
      await page.goto('/login')
      await page.fill('#email', USER_EMAIL)
      await page.fill('#password', TEST_PASSWORD)
      await page.click('button[type="submit"]')

      // La page reste sur /login. On laisse la soumission se dérouler avant de
      // conclure, sinon on constaterait seulement qu'elle n'a pas encore abouti.
      await page.waitForTimeout(3_000)
      expect(page.url()).not.toContain('/dashboard')

      // Et le dashboard reste fermé même en y allant directement.
      await page.goto('/dashboard')
      await page.waitForURL('**/login**', { timeout: 15_000 })
    } finally {
      await prisma.user.update({ where: { email: USER_EMAIL }, data: { disabledAt: null } })
    }
  })

  test('E2E-ADMIN-05 — Trace d’activité écrite à la visite du dashboard', async ({ page }) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: ACTIVITY_EMAIL } })
    expect(user.lastSeenAt).toBeNull()

    await loginAs(page, ACTIVITY_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard')

    // L'écriture part sans être attendue par le rendu : on lui laisse le temps.
    await expect
      .poll(() => prisma.userActivity.count({ where: { userId: user.id, surface: 'web' } }), {
        timeout: 15_000,
      })
      .toBe(1)

    const refreshed = await prisma.user.findUniqueOrThrow({ where: { id: user.id } })
    expect(refreshed.lastSeenAt).not.toBeNull()

    // Deuxième visite dans la même heure : l'étranglement doit la retenir.
    await page.goto('/dashboard/plantes')
    await page.waitForLoadState('networkidle')
    expect(
      await prisma.userActivity.count({ where: { userId: user.id } }),
    ).toBe(1)
  })
})
