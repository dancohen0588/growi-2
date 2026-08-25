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

// Le trajet complet d'une recommandation : du résultat de diagnostic jusqu'à
// la tâche cochée dans le calendrier. L'appel Gemini est simulé ; tout le
// reste — planification, planning, journal — est réel.

let plantId: string
let gardenId: string

const PNG_1PX = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const DIAGNOSIS = {
  diagnosed: true,
  status: 'WARNING',
  confidence: 'medium',
  summary: 'Un oïdium débutant sur les feuilles basses.',
  observations: ['Taches blanches poudreuses'],
  probableCauses: [
    { label: 'Oïdium', likelihood: 'likely', explanation: 'Chaleur et feuillage mouillé.' },
  ],
  recommendations: [
    {
      action: 'Retire les feuilles atteintes',
      priority: 'urgent',
      timeframe: "aujourd'hui",
      actionType: 'taille',
      dueInDays: 0,
    },
    {
      action: 'Pulvérise du bicarbonate dilué',
      priority: 'soon',
      timeframe: 'cette semaine',
      actionType: 'traitement',
      dueInDays: 2,
    },
  ],
  followUp: 'Reprends une photo dans 7 jours.',
}

/** Seul l'appel au modèle est simulé ; la ligne `Diagnosis` est bien écrite. */
async function mockDiagnose(page: Page) {
  await page.route('**/api/v1/plants/*/diagnose', async (route) => {
    const diagnosis = await prisma.diagnosis.create({
      data: {
        plantInstanceId: plantId,
        userId: (await prisma.plantInstance.findUniqueOrThrow({ where: { id: plantId } })).userId,
        photoUrl: 'https://exemple.test/diagnostic.jpg',
        status: DIAGNOSIS.status,
        confidence: DIAGNOSIS.confidence,
        summary: DIAGNOSIS.summary,
        payload: DIAGNOSIS as unknown as Prisma.InputJsonObject,
      },
    })

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          ...DIAGNOSIS,
          diagnosisId: diagnosis.id,
          photoUrl: diagnosis.photoUrl,
          currentHealthStatus: 'HEALTHY',
          tasksPlannedAt: null,
        },
      }),
    })
  })
}

async function runDiagnosis(page: Page) {
  await page.goto(`/dashboard/plantes/${plantId}`)
  await page.getByRole('button', { name: /Diagnostiquer ma plante/i }).click()
  await page.getByTestId('diagnosis-gallery-input').setInputFiles({
    name: 'plante.png',
    mimeType: 'image/png',
    buffer: PNG_1PX,
  })
  await page.getByRole('button', { name: /Analyser cette photo/i }).click()
  await expect(page.getByRole('dialog').getByText(DIAGNOSIS.summary)).toBeVisible()
}

test.beforeAll(async () => {
  const data = await seedTestUser()
  gardenId = data.gardenId!
  const plant = await seedTestPlant(gardenId, data.userId)
  plantId = plant.id
})

test.afterAll(async () => {
  await cleanupTestData()
})

test.beforeEach(async () => {
  await prisma.plantTask.deleteMany({ where: { plantInstanceId: plantId } })
  await prisma.diagnosis.deleteMany({ where: { plantInstanceId: plantId } })
  await prisma.careLog.deleteMany({ where: { plantInstanceId: plantId } })
})

test.describe('Planification des actions d’un diagnostic', () => {
  test('E2E-PLAN-01 — Du diagnostic au calendrier, puis au journal', async ({ page }) => {
    await mockDiagnose(page)
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await runDiagnosis(page)

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /Planifier ces actions/i }).click()
    // Délai large : sur un serveur de dev froid, la route se compile à la
    // première requête. En production ce coût n'existe pas.
    await expect(dialog.getByText(/2 actions planifiées/)).toBeVisible({ timeout: 45_000 })

    // Deux tâches, datées selon leur priorité.
    const tasks = await prisma.plantTask.findMany({
      where: { plantInstanceId: plantId },
      orderBy: { dueDate: 'asc' },
    })
    expect(tasks).toHaveLength(2)
    expect(tasks[0]).toMatchObject({ type: 'taille', priority: 'high', source: 'DIAGNOSIS' })
    expect(tasks[1]).toMatchObject({ type: 'traitement', priority: 'medium' })
    expect(tasks[0]!.dueDate < tasks[1]!.dueDate).toBe(true)

    // Elles apparaissent au calendrier, marquées comme venant d'un diagnostic.
    await page.keyboard.press('Escape')
    await page.goto('/dashboard/calendrier')
    await expect(page.getByText('Retire les feuilles atteintes').first()).toBeVisible()
    await expect(page.getByText('Diagnostic').first()).toBeVisible()

    // Cocher la tâche la retire du planning et note le geste au journal.
    // Le bouton porte le libellé de l'action, ce qui l'identifie sans ambiguïté
    // même quand plusieurs tâches sont à l'écran.
    await page
      .getByRole('button', { name: 'Marquer comme fait : Retire les feuilles atteintes' })
      .first()
      .click()

    await expect
      .poll(
        async () =>
          (await prisma.plantTask.findFirst({ where: { id: tasks[0]!.id } }))?.doneAt !== null,
        { timeout: 15_000 },
      )
      .toBe(true)

    const logs = await prisma.careLog.findMany({ where: { plantInstanceId: plantId } })
    expect(logs.map((l) => l.type)).toContain('pruning')
  })

  test('E2E-PLAN-02 — Replanifier ne crée jamais de doublon', async ({ page }) => {
    await mockDiagnose(page)
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await runDiagnosis(page)

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /Planifier ces actions/i }).click()
    // Délai large : sur un serveur de dev froid, la route se compile à la
    // première requête. En production ce coût n'existe pas.
    await expect(dialog.getByText(/2 actions planifiées/)).toBeVisible({ timeout: 45_000 })

    // L'historique rouvre le même diagnostic : le bouton doit être en état
    // accompli, et l'API refuser de recréer quoi que ce soit.
    await page.keyboard.press('Escape')
    await page.reload()
    await page.getByRole('button', { name: /À surveiller/i }).first().click()
    await expect(page.getByText(/2 actions planifiées/).first()).toBeVisible({ timeout: 45_000 })

    expect(await prisma.plantTask.count({ where: { plantInstanceId: plantId } })).toBe(2)
  })

  test('E2E-PLAN-03 — Un geste manuel clôt la tâche échue du même type', async ({ page }) => {
    await mockDiagnose(page)
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await runDiagnosis(page)

    const dialog = page.getByRole('dialog')
    await dialog.getByRole('button', { name: /Planifier ces actions/i }).click()
    // Délai large : sur un serveur de dev froid, la route se compile à la
    // première requête. En production ce coût n'existe pas.
    await expect(dialog.getByText(/2 actions planifiées/)).toBeVisible({ timeout: 45_000 })

    const pruning = await prisma.plantTask.findFirstOrThrow({
      where: { plantInstanceId: plantId, type: 'taille' },
    })

    // Une taille notée à la main accomplit de fait la tâche du jour : sans ce
    // rattrapage elle disparaîtrait du planning sans jamais être close.
    await page.request.post(`/api/v1/plants/${plantId}/logs`, { data: { type: 'pruning' } })

    await expect
      .poll(
        async () => (await prisma.plantTask.findFirst({ where: { id: pruning.id } }))?.doneAt,
        { timeout: 15_000 },
      )
      .not.toBeNull()

    // La tâche de traitement, due plus tard, n'est pas touchée.
    const treatment = await prisma.plantTask.findFirstOrThrow({
      where: { plantInstanceId: plantId, type: 'traitement' },
    })
    expect(treatment.doneAt).toBeNull()
  })
})
