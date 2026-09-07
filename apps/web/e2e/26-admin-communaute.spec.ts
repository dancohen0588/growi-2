import { test, expect } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { loginAs, prisma, TEST_PASSWORD } from './fixtures'

/**
 * Admin — indicateurs et fiche, volet communauté.
 *
 * Même enjeu que `22-admin-kpis` : le **SQL brut** des indicateurs échappe au
 * typecheck et aux tests unitaires, qui doublent Prisma. Une requête fautive
 * fait répondre 500 à la page — c'est donc son rendu qui l'atteste.
 *
 * ⚠️ Le tableau de bord est mis en cache dix minutes **sur disque**
 * (`.next/cache`) : après une modification du calcul, `rm -rf apps/web/.next/cache`
 * pour ne pas relire l'ancienne valeur.
 */

const ADMIN_EMAIL = 'test-e2e-comm-admin@growi-garden.fr'
const MEMBER_EMAIL = 'test-e2e-comm-membre@growi-garden.fr'
const EMAILS = [ADMIN_EMAIL, MEMBER_EMAIL]

let memberId = ''

async function cleanup() {
  await prisma.adminAuditLog.deleteMany({ where: { actor: { email: { in: EMAILS } } } })
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } })
}

test.beforeAll(async () => {
  await cleanup()
  const password = await bcrypt.hash(TEST_PASSWORD, 10)

  await prisma.user.create({
    data: { email: ADMIN_EMAIL, firstName: 'Modérateur', password, role: 'ADMIN' },
  })

  // Un compte qui alimente les quatre familles d'indicateurs à la fois.
  const member = await prisma.user.create({
    data: {
      email: MEMBER_EMAIL,
      firstName: 'Membre',
      password,
      onboarded: true,
      handle: 'e2e_membre_admin',
      bio: 'Un potager e2e.',
      communityEnabled: true,
      communityEnabledAt: new Date(),
      locationCity: 'Tours',
      latitude: 47.3941,
      longitude: 0.6848,
      fuzzyLat: 47.39,
      fuzzyLng: 0.69,
      postCount: 1,
    },
  })
  memberId = member.id

  const post = await prisma.post.create({
    data: {
      userId: member.id,
      body: 'Publication e2e pour l’admin',
      photos: ['https://exemple.test/admin.jpg'],
      lat: 47.39,
      lng: 0.69,
      // Antérieure de trois jours : assez ancienne pour entrer dans le
      // dénominateur du taux de réaction, qui écarte les 48 dernières heures.
      createdAt: new Date(Date.now() - 3 * 86_400_000),
    },
  })

  await prisma.listing.create({
    data: {
      userId: member.id,
      kind: 'give',
      category: 'seeds',
      title: 'Annonce e2e pour l’admin',
      lat: 47.39,
      lng: 0.69,
      expiresAt: new Date(Date.now() + 60 * 86_400_000),
    },
  })

  await prisma.report.create({
    data: {
      reporterId: member.id,
      targetType: 'post',
      targetId: post.id,
      reason: 'spam',
      note: 'Signalement e2e',
    },
  })
})

test.afterAll(cleanup)

test.describe('Admin — communauté', () => {
  test('E2E-ADMIN-60 — Les indicateurs de la communauté se calculent', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)

    const response = await page.goto('/admin')
    // Le contrôle qui compte : le SQL du taux de réaction donnerait 500.
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { name: 'Communauté' })).toBeVisible()
    await expect(page.getByText('Profils publics activés')).toBeVisible()
    await expect(page.getByText('Signalements pour 1 000 contenus')).toBeVisible()
  })

  test('E2E-ADMIN-61 — La file de modération montre le contenu signalé', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)

    const response = await page.goto('/admin/signalements')
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { name: 'Signalements' })).toBeVisible()
    await expect(page.getByText('Publication e2e pour l’admin')).toBeVisible()
    // La note du signaleur est ce qui explique *pourquoi* un contenu dérange.
    await expect(page.getByText('Signalement e2e')).toBeVisible()
  })

  test('E2E-ADMIN-62 — L’onglet Communauté de la fiche liste tout', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)

    const response = await page.goto(`/admin/utilisateurs/${memberId}?onglet=communaute`)
    expect(response?.status()).toBe(200)

    await expect(page.getByRole('heading', { name: 'Profil public' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'e2e_membre_admin' })).toBeVisible()
    await expect(page.getByText('Publication e2e pour l’admin')).toBeVisible()
    await expect(page.getByText('Annonce e2e pour l’admin')).toBeVisible()
    // La position affichée est la **floutée**, celle que voient les autres.
    await expect(page.getByText(/floutée/)).toBeVisible()
  })

  test('E2E-ADMIN-63 — Un compte hors communauté le dit, sans table vide', async ({ page }) => {
    const admin = await prisma.user.findUniqueOrThrow({ where: { email: ADMIN_EMAIL } })

    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto(`/admin/utilisateurs/${admin.id}?onglet=communaute`)

    await expect(page.getByText('Pas de profil public')).toBeVisible()
  })
})
