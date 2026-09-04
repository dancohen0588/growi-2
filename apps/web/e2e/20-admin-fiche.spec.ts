import { test, expect } from '@playwright/test'
import bcrypt from 'bcryptjs'
import { loginAs, prisma, TEST_PASSWORD } from './fixtures'

// Fiche utilisateur : onglets, édition du profil et actions.

const ADMIN_EMAIL = 'test-e2e-fiche-admin@growi-garden.fr'
const TARGET_EMAIL = 'test-e2e-fiche-cible@growi-garden.fr'
const EMAILS = [ADMIN_EMAIL, TARGET_EMAIL]

let targetId = ''
let gardenId = ''
let plantId = ''

async function cleanup() {
  await prisma.adminAuditLog.deleteMany({ where: { actor: { email: { in: EMAILS } } } })
  await prisma.user.deleteMany({ where: { email: { in: EMAILS } } })
}

test.beforeAll(async () => {
  await cleanup()
  const password = await bcrypt.hash(TEST_PASSWORD, 10)

  await prisma.user.create({
    data: { email: ADMIN_EMAIL, firstName: 'Fiche', password, role: 'ADMIN' },
  })

  const target = await prisma.user.create({
    data: {
      email: TARGET_EMAIL,
      firstName: 'Cible',
      lastName: 'Fiche',
      password,
      onboarded: true,
      latitude: 48.85,
      longitude: 2.35,
    },
  })
  targetId = target.id

  const garden = await prisma.garden.create({
    data: { userId: target.id, name: 'Jardin de la fiche', type: 'OUTDOOR', surfaceM2: 120 },
  })
  gardenId = garden.id

  const plant = await prisma.plantInstance.create({
    data: {
      userId: target.id,
      gardenId: garden.id,
      customName: 'Rosier de test',
      location: 'OUTDOOR',
      lastWateredAt: new Date(),
      lastFertilizedAt: new Date(),
    },
  })
  plantId = plant.id
})

test.afterAll(cleanup)

test.describe('Admin — fiche utilisateur', () => {
  test('E2E-ADMIN-20 — Les six onglets s’ouvrent', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto(`/admin/utilisateurs/${targetId}`)

    await expect(page.getByRole('heading', { name: 'Cible Fiche' })).toBeVisible()

    for (const [tab, marker] of [
      ['jardins', 'Jardin de la fiche'],
      ['plantes', 'Rosier de test'],
      ['ia', 'Diagnostics'],
      ['activite', 'Sessions mobiles'],
      ['actions', 'Recalculer les conseils'],
      ['profil', 'Modifier le profil'],
    ] as const) {
      await page.goto(`/admin/utilisateurs/${targetId}?onglet=${tab}`)
      await expect(page.getByText(marker).first()).toBeVisible()
    }

    await page.screenshot({ path: 'test-results/admin-fiche.png', fullPage: true })
  })

  test('E2E-ADMIN-21 — Un identifiant inconnu donne une 404', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    const res = await page.goto('/admin/utilisateurs/compte-qui-nexiste-pas')
    expect(res?.status()).toBe(404)
  })

  test('E2E-ADMIN-22 — Modifier un prénom l’enregistre et le journalise', async ({ page }) => {
    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto(`/admin/utilisateurs/${targetId}?onglet=profil`)

    await page.fill('input[name="firstName"]', 'Prénom modifié')
    await page.getByRole('button', { name: 'Enregistrer' }).click()
    await expect(page.getByRole('status')).toContainText('Profil enregistré', { timeout: 15_000 })

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: targetId } })
    expect(updated.firstName).toBe('Prénom modifié')

    await expect
      .poll(() =>
        prisma.adminAuditLog.count({ where: { action: 'user.update', targetId } }),
      )
      .toBeGreaterThan(0)
  })

  test('E2E-ADMIN-23 — Recalculer les conseils vide le cache du jardin', async ({ page }) => {
    // On sème une entrée de cache : l'action doit la faire disparaître.
    await prisma.gardenAdviceCache.deleteMany({ where: { gardenId } })
    await prisma.gardenAdviceCache.create({
      data: {
        gardenId,
        payload: { actions: [] },
        expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000),
      },
    })

    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto(`/admin/utilisateurs/${targetId}?onglet=actions`)

    await page.getByRole('button', { name: 'Recalculer les conseils' }).click()
    await expect(page.getByRole('status')).toContainText('Conseils recalculés', {
      timeout: 15_000,
    })

    expect(await prisma.gardenAdviceCache.count({ where: { gardenId } })).toBe(0)
  })

  test('E2E-ADMIN-24 — Le niveau 3 garde les gestes notés', async ({ page }) => {
    await prisma.careLog.create({
      data: { plantInstanceId: plantId, type: 'watering', occurredAt: new Date() },
    })

    await loginAs(page, ADMIN_EMAIL, TEST_PASSWORD)
    await page.goto(`/admin/utilisateurs/${targetId}?onglet=actions`)

    await page.getByRole('button', { name: 'Remettre à zéro le suivi d’entretien' }).click()
    await page.fill('input[autocomplete="off"]', 'RESET')
    await page.getByRole('button', { name: 'Remettre à zéro' }).click()

    // On attend le **compte rendu de l'action**, pas un texte quelconque : le
    // corps du dialogue contient lui aussi « remis à zéro », et il reste
    // affiché le temps de son animation de fermeture. Une recherche par texte
    // libre le matcherait et laisserait la suite courir pendant que l'action
    // est encore en vol.
    await expect(page.getByRole('status')).toContainText('remis à zéro', { timeout: 15_000 })

    const plant = await prisma.plantInstance.findUniqueOrThrow({ where: { id: plantId } })
    expect(plant.lastWateredAt).toBeNull()
    expect(plant.lastFertilizedAt).toBeNull()

    // Les gestes sont des faits : ils survivent à la remise à zéro.
    expect(await prisma.careLog.count({ where: { plantInstanceId: plantId } })).toBeGreaterThan(0)
  })

  test('E2E-ADMIN-25 — Un compte ordinaire n’atteint pas la fiche', async ({ page }) => {
    await loginAs(page, TARGET_EMAIL, TEST_PASSWORD)
    await page.goto(`/admin/utilisateurs/${targetId}`)
    await page.waitForURL('**/dashboard**', { timeout: 15_000 })
  })
})
