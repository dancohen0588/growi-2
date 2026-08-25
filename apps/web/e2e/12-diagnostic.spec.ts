import { test, expect, type Page } from '@playwright/test'
import type { Prisma } from '@prisma/client'
import {
  loginAs,
  seedTestUser,
  seedTestPlant,
  cleanupTestData,
  prisma,
  TEST_EMAIL,
  TEST_PASSWORD,
} from './fixtures'

// Parcours complet du diagnostic IA, l'appel Gemini simulé au niveau de la
// route : ce qui est vérifié ici, c'est l'enchaînement CTA → photo → résultat
// → mise à jour du statut → historique, et le fait que rien ne change tant que
// l'utilisateur n'a pas donné son accord.

let plantId: string

// Une image PNG minimale valide, suffisante pour l'input file.
const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const DIAGNOSIS = {
  diagnosed: true,
  status: 'WARNING',
  confidence: 'medium',
  summary: 'Un stress hydrique probable après la canicule.',
  observations: ['Feuilles basses jaunies', 'Terreau sec en surface'],
  probableCauses: [
    {
      label: 'Manque d’eau',
      likelihood: 'likely',
      explanation: 'Trois jours à 34 °C et un dernier arrosage il y a six jours.',
    },
  ],
  recommendations: [
    { action: 'Arrose abondamment ce soir', priority: 'urgent', timeframe: "aujourd'hui" },
    { action: 'Paille le pied', priority: 'soon', timeframe: 'cette semaine' },
  ],
  followUp: 'Reprends une photo dans 7 jours pour vérifier l’évolution.',
}

/**
 * Simule la route de diagnostic — l'appel Gemini réel serait facturé, lent, et
 * son résultat varierait d'une exécution à l'autre. Les routes d'historique,
 * elles, restent réelles : c'est la persistance qu'on veut vérifier.
 */
async function mockDiagnose(page: Page, body: Record<string, unknown> = DIAGNOSIS) {
  await page.route('**/api/v1/plants/*/diagnose', async (route) => {
    const diagnosis = await prisma.diagnosis.create({
      data: {
        plantInstanceId: plantId,
        userId: (await prisma.plantInstance.findUniqueOrThrow({ where: { id: plantId } })).userId,
        photoUrl: 'https://exemple.test/diagnostic.jpg',
        status: (body.status as string) ?? 'WARNING',
        confidence: (body.confidence as string) ?? 'medium',
        summary: (body.summary as string) ?? '',
        payload: body as Prisma.InputJsonObject,
      },
    })

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          ...body,
          diagnosisId: diagnosis.id,
          photoUrl: diagnosis.photoUrl,
          currentHealthStatus: 'HEALTHY',
        },
      }),
    })
  })
}

test.beforeAll(async () => {
  const data = await seedTestUser()
  const plant = await seedTestPlant(data.gardenId!, data.userId)
  plantId = plant.id
})

test.afterAll(async () => {
  await cleanupTestData()
})

test.describe('Diagnostic IA', () => {
  test('E2E-DIAG-01 — Parcours complet : photo → résultat → mise à jour → historique', async ({
    page,
  }) => {
    await mockDiagnose(page)
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto(`/dashboard/plantes/${plantId}`)

    // Le CTA est présent sur la fiche.
    const cta = page.getByRole('button', { name: /Diagnostiquer ma plante/i })
    await expect(cta).toBeVisible()
    await cta.click()

    // Étape photo, puis analyse.
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByTestId('diagnosis-gallery-input').setInputFiles({
      name: 'plante.png',
      mimeType: 'image/png',
      buffer: PNG_1PX,
    })
    await page.getByRole('button', { name: /Analyser cette photo/i }).click()

    // Étape résultat : le diagnostic est rendu en entier. Les assertions
    // portent sur la modale — l'historique, derrière elle, répète les mêmes
    // phrases dès le deuxième diagnostic.
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Un stress hydrique probable après la canicule.')).toBeVisible()
    await expect(dialog.getByText('Feuilles basses jaunies')).toBeVisible()
    await expect(dialog.getByText('Manque d’eau')).toBeVisible()
    await expect(dialog.getByText('Arrose abondamment ce soir')).toBeVisible()
    await expect(dialog.getByText(/Reprends une photo dans 7 jours/)).toBeVisible()

    // Tant qu'on n'a pas accepté, la plante n'a pas changé d'état.
    expect(
      (await prisma.plantInstance.findUniqueOrThrow({ where: { id: plantId } })).healthStatus,
    ).toBe('HEALTHY')

    // Accord de l'utilisateur.
    await page.getByRole('button', { name: /^Mettre à jour$/ }).click()
    // L'écriture traverse la transaction de journal puis l'invalidation du
    // cache de conseils : plus long qu'un aller-retour ordinaire.
    await expect(dialog.getByText(/L'état de la plante a été mis à jour/)).toBeVisible({
      timeout: 15_000,
    })

    // La fiche, le journal et le diagnostic sont cohérents.
    const plant = await prisma.plantInstance.findUniqueOrThrow({ where: { id: plantId } })
    expect(plant.healthStatus).toBe('WARNING')
    expect(plant.healthNote).toBe('Un stress hydrique probable après la canicule.')

    const healthLogs = await prisma.careLog.findMany({
      where: { plantInstanceId: plantId, type: 'health' },
    })
    expect(healthLogs).toHaveLength(1)
    expect(healthLogs[0]?.status).toBe('WARNING')

    // Fermeture de la modale : l'historique montre le diagnostic.
    await page.keyboard.press('Escape')
    const history = page.getByRole('heading', { name: /Historique des diagnostics/i })
    await expect(history).toBeVisible()
    await expect(page.getByText('appliqué à la fiche')).toBeVisible()
  })

  test('E2E-DIAG-02 — Le statut reste inchangé si l’utilisateur ignore', async ({ page }) => {
    await prisma.plantInstance.update({
      where: { id: plantId },
      data: { healthStatus: 'HEALTHY' },
    })
    await mockDiagnose(page)
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto(`/dashboard/plantes/${plantId}`)

    await page.getByRole('button', { name: /Diagnostiquer ma plante/i }).click()
    await page.getByTestId('diagnosis-gallery-input').setInputFiles({
      name: 'plante.png',
      mimeType: 'image/png',
      buffer: PNG_1PX,
    })
    await page.getByRole('button', { name: /Analyser cette photo/i }).click()
    await expect(page.getByRole('button', { name: /^Mettre à jour$/ })).toBeVisible()

    await page.getByRole('button', { name: /^Ignorer$/ }).click()

    // Le résultat reste lisible, mais rien n'a été écrit sur la plante.
    await expect(
      page.getByRole('dialog').getByText('Un stress hydrique probable après la canicule.'),
    ).toBeVisible()
    expect(
      (await prisma.plantInstance.findUniqueOrThrow({ where: { id: plantId } })).healthStatus,
    ).toBe('HEALTHY')
  })

  test('E2E-DIAG-03 — Photo inexploitable : motif actionnable, rien en base', async ({
    page,
  }) => {
    await page.route('**/api/v1/plants/*/diagnose', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            diagnosed: false,
            reason: 'Reprends la photo en plein jour, feuilles bien visibles.',
            diagnosisId: null,
            photoUrl: null,
            currentHealthStatus: 'HEALTHY',
          },
        }),
      }),
    )

    const before = await prisma.diagnosis.count({ where: { plantInstanceId: plantId } })

    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto(`/dashboard/plantes/${plantId}`)
    await page.getByRole('button', { name: /Diagnostiquer ma plante/i }).click()
    await page.getByTestId('diagnosis-gallery-input').setInputFiles({
      name: 'floue.png',
      mimeType: 'image/png',
      buffer: PNG_1PX,
    })
    await page.getByRole('button', { name: /Analyser cette photo/i }).click()

    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Diagnostic impossible')).toBeVisible()
    await expect(
      dialog.getByText('Reprends la photo en plein jour, feuilles bien visibles.'),
    ).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Réessayer/i })).toBeVisible()

    expect(await prisma.diagnosis.count({ where: { plantInstanceId: plantId } })).toBe(before)
  })

  test('E2E-DIAG-04 — Gemini saturé : message clair, l’app tient debout', async ({ page }) => {
    await page.route('**/api/v1/plants/*/diagnose', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({
          error: { code: 'UNAVAILABLE', message: 'Service de diagnostic indisponible.' },
        }),
      }),
    )

    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto(`/dashboard/plantes/${plantId}`)
    await page.getByRole('button', { name: /Diagnostiquer ma plante/i }).click()
    await page.getByTestId('diagnosis-gallery-input').setInputFiles({
      name: 'plante.png',
      mimeType: 'image/png',
      buffer: PNG_1PX,
    })
    await page.getByRole('button', { name: /Analyser cette photo/i }).click()

    // On revient à l'étape photo avec le motif affiché : l'utilisateur peut
    // relancer sans rouvrir la modale.
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByText('Service de diagnostic indisponible.')).toBeVisible()
    await expect(dialog.getByRole('button', { name: /Analyser cette photo/i })).toBeVisible()
  })
})
