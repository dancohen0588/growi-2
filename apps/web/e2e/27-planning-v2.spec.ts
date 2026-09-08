import { test, expect, type Page } from '@playwright/test'
import {
  loginAs,
  seedTestUser,
  cleanupTestData,
  clearAdviceCache,
  prisma,
  TEST_EMAIL,
  TEST_PASSWORD,
} from './fixtures'

/**
 * Le planning v2 : une carte d'arrosage pour N plantes, une popin qui explique
 * enfin *pourquoi*, un menu de section qui distingue « tout marquer fait » de
 * « ignorer », et un « Annuler » qui efface vraiment le geste du journal.
 *
 * Ces parcours passent par la vraie base : chacun repart d'un jardin nettoyé.
 */

let userId: string
let gardenId: string

const DAY_MS = 86_400_000

/** Une plante qui réclame de l'eau aujourd'hui : r1 s'en charge. */
async function seedThirstyPlant(name: string) {
  return prisma.plantInstance.create({
    data: {
      userId,
      gardenId,
      location: 'OUTDOOR',
      customName: name,
      emoji: '🌿',
      wateringFreqDays: 3,
      lastWateredAt: new Date(Date.now() - 10 * DAY_MS),
    },
  })
}

async function resetGarden() {
  await prisma.careLog.deleteMany({ where: { plantInstance: { userId } } })
  await prisma.plantInstance.deleteMany({ where: { userId } })
  await prisma.garden.update({ where: { id: gardenId }, data: { planningClearedOn: null } })
  await clearAdviceCache(gardenId)
}

async function openCalendar(page: Page) {
  await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
  await page.goto('/dashboard/calendrier')
  // `next dev` compile la route au premier passage : cinq secondes n'y
  // suffisent pas, et l'attente n'a rien à voir avec ce qu'on teste.
  await expect(page.getByRole('heading', { name: /Ton calendrier jardin/ })).toBeVisible({
    timeout: 60_000,
  })
}

test.beforeAll(async () => {
  const data = await seedTestUser()
  userId = data.userId
  gardenId = data.gardenId!

  // Sans coordonnées, le moteur travaille sur une météo neutre au lieu
  // d'appeler Open-Meteo. Chaque test vide le cache de conseils : garder
  // l'appel réseau, c'est le payer sept fois et dépendre d'un tiers pour
  // savoir si nos cartes s'affichent.
  await prisma.user.update({
    where: { id: userId },
    data: { latitude: null, longitude: null },
  })
})

/**
 * Fait compiler `/login`, `/dashboard` et le calendrier avant de chronométrer
 * quoi que ce soit.
 *
 * `next dev` compile à la demande, et le premier passage prend des dizaines de
 * secondes — dont trente que `loginAs` s'accorde au maximum avant d'abandonner.
 * Le premier test échouait donc sur un serveur froid, en restant sur la page de
 * connexion, pour une raison sans aucun rapport avec le planning.
 */
test.beforeAll(async ({ browser }) => {
  // Le `configure` plus bas ne couvre que les tests : un hook garde les trente
  // secondes par défaut, soit moins que la compilation qu'il déclenche.
  test.setTimeout(180_000)

  const page = await browser.newPage()
  try {
    await page.goto('/login')
    await page.fill('#email', TEST_EMAIL)
    await page.fill('#password', TEST_PASSWORD)
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard**', { timeout: 120_000 })
    await page.goto('/dashboard/calendrier')
    await page.getByRole('heading', { name: /Ton calendrier jardin/ }).waitFor({ timeout: 120_000 })
  } finally {
    await page.close()
  }
})

test.afterAll(async () => {
  await cleanupTestData()
})

test.beforeEach(async () => {
  await resetGarden()
})

// Chaque test se reconnecte, et `next dev` peut recompiler : les 30 secondes
// par défaut partaient entièrement dans la connexion, et le test échouait sans
// que rien ne soit cassé dans le produit.
test.describe.configure({ timeout: 180_000 })

test.describe('Planning v2', () => {
  test('E2E-PLAN-01 — cinq arrosages tiennent en une carte', async ({ page }) => {
    for (const name of ['Basilic', 'Menthe', 'Rosier']) await seedThirstyPlant(name)

    await openCalendar(page)

    // Une carte pour les trois, pas trois cartes.
    await expect(page.getByRole('heading', { name: /Arrosage · 3 plantes/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Tout arrosé/ })).toBeVisible()
  })

  test('E2E-PLAN-02 — « Tout arrosé » note les trois gestes en un appel', async ({ page }) => {
    for (const name of ['Basilic', 'Menthe', 'Rosier']) await seedThirstyPlant(name)

    await openCalendar(page)
    await page.getByRole('button', { name: /Tout arrosé/ }).click()

    // Le toast passe ; « Fait aujourd'hui », lui, reste — et c'est cette liste
    // qui doit porter les trois gestes.
    await expect(page.getByText(/3 gestes faits aujourd/)).toBeVisible({ timeout: 15_000 })

    // Le journal fait foi : trois arrosages écrits, et les plantes le savent.
    await expect
      .poll(async () => prisma.careLog.count({ where: { plantInstance: { userId }, type: 'watering' } }))
      .toBe(3)
    expect(
      await prisma.plantInstance.count({ where: { userId, lastWateredAt: { gte: new Date(Date.now() - DAY_MS) } } }),
    ).toBe(3)
  })

  test('E2E-PLAN-03 — « Choisir » permet de décocher l’exception', async ({ page }) => {
    for (const name of ['Basilic', 'Menthe']) await seedThirstyPlant(name)

    await openCalendar(page)
    await page.getByRole('button', { name: 'Choisir' }).click()

    // Toutes cochées par défaut : on décoche celle qu'on n'a pas arrosée.
    await page.getByRole('checkbox').first().uncheck()
    await page.getByRole('button', { name: /Valider \(1\)/ }).click()

    await expect
      .poll(async () => prisma.careLog.count({ where: { plantInstance: { userId } } }))
      .toBe(1)
  })

  test('E2E-PLAN-04 — la popin dit pourquoi maintenant, pour une action du moteur', async ({
    page,
  }) => {
    await seedThirstyPlant('Basilic')

    await openCalendar(page)
    // Un seul arrosage : carte unitaire, avec son bouton « Détails ».
    await page.getByRole('button', { name: 'Détails' }).first().click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Pourquoi maintenant')).toBeVisible()
    // Le « pourquoi » est écrit par la règle avec les données de la plante.
    await expect(dialog.getByText(/fréquence de 3 jours/)).toBeVisible()
    await expect(dialog.getByText(/moteur Growi/i)).toBeVisible()
  })

  test('E2E-PLAN-05 — « Ignorer » masque sans rien écrire au journal', async ({ page }) => {
    await seedThirstyPlant('Basilic')

    await openCalendar(page)
    await page.getByRole('button', { name: 'Actions groupées de la section' }).first().click()
    await page.getByRole('menuitem', { name: /Ignorer pour aujourd/ }).click()
    await page.getByRole('button', { name: 'Ignorer' }).click()

    await expect(page.getByText(/Actions ignorées pour aujourd/)).toBeVisible({ timeout: 15_000 })

    // Rien au journal : c'est toute la différence avec « tout marquer fait ».
    expect(await prisma.careLog.count({ where: { plantInstance: { userId } } })).toBe(0)
    await expect
      .poll(async () =>
        (await prisma.garden.findUnique({ where: { id: gardenId } }))?.planningClearedOn,
      )
      .not.toBeNull()

    // « Rétablir » rend la journée.
    await page.getByRole('button', { name: 'Rétablir' }).click()
    await expect
      .poll(async () =>
        (await prisma.garden.findUnique({ where: { id: gardenId } }))?.planningClearedOn,
      )
      .toBeNull()
  })

  test('E2E-PLAN-06 — « Annuler » efface le geste et remet la plante d’avant', async ({ page }) => {
    const plant = await seedThirstyPlant('Basilic')
    const before = plant.lastWateredAt!
    // L'arrosage d'il y a dix jours a bien eu lieu : c'est vers cette date-là
    // que la plante doit revenir, et non vers « jamais arrosée ».
    await prisma.careLog.create({
      data: { plantInstanceId: plant.id, type: 'watering', occurredAt: before },
    })

    await openCalendar(page)
    await page.getByRole('button', { name: /Marquer comme fait/ }).first().click()

    await expect(page.getByText(/geste fait aujourd/)).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Voir et annuler' }).click()
    await page.getByRole('button', { name: 'Annuler' }).first().click()

    // Le geste quitte le journal, et la date de la plante revient à l'ancienne
    // — pas à `null`, qui ferait croire qu'elle n'a jamais été arrosée.
    await expect
      .poll(async () => prisma.careLog.count({ where: { plantInstance: { userId } } }))
      .toBe(1)
    const after = await prisma.plantInstance.findUnique({ where: { id: plant.id } })
    expect(after?.lastWateredAt?.toISOString()).toBe(before.toISOString())
  })

  test('E2E-PLAN-07 — une taille de saison ne crie pas « en retard »', async ({ page }) => {
    // Une plante dont le catalogue place la taille sur le mois courant : la
    // règle r4 produit une fenêtre, donc une ligne calme dans « Ce mois-ci ».
    const month = new Date().getMonth() + 1
    // r4 ne lit `pruningMonths` qu'en JSON : filtrer en SQL sur le texte
    // retiendrait aussi les fiches en CSV, dont la règle ne tire rien.
    const candidates = await prisma.plantCatalog.findMany({
      where: { pruningMonths: { not: null } },
      select: { id: true, pruningMonths: true },
    })
    const catalog = candidates.find((row) => {
      try {
        const months = JSON.parse(row.pruningMonths!)
        return Array.isArray(months) && months.includes(month)
      } catch {
        return false
      }
    })
    test.skip(!catalog, 'aucune plante du catalogue ne se taille ce mois-ci')

    await prisma.plantInstance.create({
      data: {
        userId,
        gardenId,
        catalogPlantId: catalog!.id,
        location: 'OUTDOOR',
        customName: 'Arbuste E2E',
        emoji: '🌳',
      },
    })
    await clearAdviceCache(gardenId)

    await openCalendar(page)

    await expect(page.getByRole('heading', { name: /Ce mois-ci, à ton rythme/ })).toBeVisible()
    await expect(page.getByText(/en retard/)).toHaveCount(0)
  })
})
