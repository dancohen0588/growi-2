import { test, expect, type Page } from '@playwright/test'
import {
  cleanupTestData,
  loginAs,
  prisma,
  seedTestUser,
  TEST_EMAIL,
  TEST_PASSWORD,
} from './fixtures'

/**
 * Import du terrain depuis le cadastre.
 *
 * Les routes `/api/v1/cadastre/*` sont interceptées : aucun appel à l'IGN
 * n'est fait pendant les tests, et les réponses sont celles, réduites, d'une
 * parcelle carrée de 20 × 20 m avec une maison de 8 × 8 m.
 */

let userId: string
let gardenId: string

const IDU = '785512510A1948'

const CANDIDATES = [
  {
    idu: IDU,
    section: '0A',
    numero: '1948',
    communeName: 'Saint-Germain-en-Laye',
    contenanceM2: 405,
    distanceM: 16,
    thumbnailUrl: 'https://data.geopf.fr/wms-r/wms?SERVICE=WMS&REQUEST=GetMap&LAYERS=demo',
  },
  {
    idu: '785512510A2276',
    section: '0A',
    numero: '2276',
    communeName: 'Saint-Germain-en-Laye',
    contenanceM2: 612,
    distanceM: 22,
    thumbnailUrl: 'https://data.geopf.fr/wms-r/wms?SERVICE=WMS&REQUEST=GetMap&LAYERS=demo2',
  },
]

const DETAIL = {
  idu: IDU,
  section: '0A',
  numero: '1948',
  contenanceM2: 405,
  thumbnailUrl: 'https://data.geopf.fr/wms-r/wms?SERVICE=WMS&REQUEST=GetMap&LAYERS=demo',
  outlineM: [
    { x: 0, y: 0 },
    { x: 20, y: 0 },
    { x: 20, y: 20 },
    { x: 0, y: 20 },
  ],
  bboxM: { width: 20, height: 20 },
  originLonLat: { lon: 2.0616, lat: 48.8921 },
  buildings: [
    {
      footprintM: [
        { x: 4, y: 4 },
        { x: 12, y: 4 },
        { x: 12, y: 12 },
        { x: 4, y: 12 },
      ],
      areaInParcelM2: 64,
      light: false,
    },
  ],
  builtM2: 64,
  gardenM2: 341,
}

/** Répond aux deux routes du cadastre sans jamais sortir du navigateur. */
async function stubCadastre(page: Page, options: { status?: number } = {}) {
  await page.route('**/api/v1/cadastre/parcels?**', route =>
    options.status
      ? route.fulfill({
          status: options.status,
          json: { error: { code: 'UNAVAILABLE', message: 'Le cadastre ne répond pas' } },
        })
      : route.fulfill({ json: { data: CANDIDATES } }),
  )
  await page.route('**/api/v1/cadastre/parcels/*', route =>
    route.fulfill({ json: { data: DETAIL } }),
  )
  // Les vignettes viennent de l'IGN : on ne les charge pas non plus.
  await page.route('https://data.geopf.fr/**', route => route.abort())
}

test.beforeAll(async () => {
  const seeded = await seedTestUser()
  userId = seeded.userId
  gardenId = seeded.gardenId!
})

test.beforeEach(async () => {
  // Chaque scénario part d'un plan vierge : c'est là que l'assistant s'ouvre.
  await prisma.garden.update({
    where: { id: gardenId },
    data: { canvasData: null, surfaceM2: null, type: 'OUTDOOR' },
  })
  await prisma.user.update({
    where: { id: userId },
    data: { latitude: 48.891851, longitude: 2.061952, address: '3 allée des Cerisiers' },
  })
})

test.afterAll(async () => {
  await cleanupTestData()
})

test.describe('Import du terrain depuis le cadastre', () => {
  test('E2E-CAD-01 — De l’assistant au plan : contour, maison et surface', async ({ page }) => {
    await stubCadastre(page)
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard/jardin')

    // L'assistant s'ouvre seul sur un plan vierge, sur l'étape « Le terrain ».
    const cadastreButton = page.getByRole('button', {
      name: /Retrouver mon terrain sur le cadastre/,
    })
    await expect(cadastreButton).toBeVisible({ timeout: 30_000 })
    await cadastreButton.click()

    // Le compte a une adresse : on va droit aux candidates.
    await expect(page.getByText('Laquelle est ta parcelle ?')).toBeVisible()
    await expect(page.getByText('Section 0A · n° 1948')).toBeVisible()
    await page.getByRole('button', { name: 'Continuer' }).click()

    // L'apostrophe du DOM vient de `&apos;` : une expression régulière évite
    // de faire dépendre le test du caractère exact.
    await expect(page.getByText(/Voici ce qu.on va poser sur ton plan/)).toBeVisible()
    await expect(page.getByText(/Terrain hors bâti/)).toBeVisible()
    await page.getByRole('button', { name: 'Poser sur mon plan' }).click()

    // Le plan est dessiné en canvas : la table accessible dit ce qu'il porte.
    const plan = page.getByRole('table', { name: 'Éléments dans ton jardin' })
    await expect(plan.getByRole('cell', { name: 'terrain', exact: true })).toBeVisible()
    await expect(plan.getByRole('cell', { name: 'maison', exact: true })).toBeVisible()
    await expect(
      plan.getByRole('cell', { name: 'Limite de parcelle · 0A 1948' }),
    ).toBeVisible()
    await expect(page.getByText('Terrain importé du cadastre')).toBeVisible()

    // La surface retenue part en base, hors bâti.
    await expect(async () => {
      const res = await page.request.get(`/api/v1/gardens/${gardenId}`)
      expect((await res.json()).data.surfaceM2).toBe(341)
    }).toPass({ timeout: 10_000 })

    // Et le plan lui-même est enregistré (sauvegarde différée de 1,5 s).
    await expect(async () => {
      const garden = await prisma.garden.findUnique({ where: { id: gardenId } })
      expect(garden?.canvasData).toContain('"type":"terrain"')
    }).toPass({ timeout: 15_000 })
  })

  test('E2E-CAD-02 — Sans adresse en compte, l’écran adresse s’affiche d’abord', async ({ page }) => {
    await prisma.user.update({
      where: { id: userId },
      data: { latitude: null, longitude: null, address: null },
    })
    await stubCadastre(page)
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard/jardin')

    const cadastreButton = page.getByRole('button', {
      name: /Retrouver mon terrain sur le cadastre/,
    })
    await expect(cadastreButton).toBeVisible({ timeout: 30_000 })
    await expect(cadastreButton).toContainText('Indique ton adresse')
    await cadastreButton.click()

    await expect(page.getByText('Où est ton jardin ?')).toBeVisible()
    await expect(page.getByLabel('Adresse', { exact: true })).toBeVisible()
    await expect(
      page.getByText(/Enregistrer cette adresse dans mon compte/),
    ).toBeVisible()
  })

  test('E2E-CAD-03 — IGN indisponible : message, et saisie manuelle intacte', async ({ page }) => {
    await stubCadastre(page, { status: 503 })
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard/jardin')

    await page.getByRole('button', { name: /Retrouver mon terrain sur le cadastre/ }).click()

    await expect(page.getByText(/Le cadastre ne répond pas pour le moment/)).toBeVisible()
    await expect(page.getByRole('button', { name: 'Réessayer' })).toBeVisible()
    await page.getByRole('button', { name: 'Renseigner à la main' }).click()

    // Rien n'a été écrit : le plan est toujours vide et les champs répondent.
    const largeur = page.getByLabel('Largeur (m)')
    await largeur.fill('12')
    await expect(page.getByText(/Surface :/)).toContainText('m²')
    const garden = await prisma.garden.findUnique({ where: { id: gardenId } })
    expect(garden?.canvasData ?? '').not.toContain('"type":"terrain"')
  })

  test('E2E-CAD-06 — L’adresse cherchée est affichée, et modifiable', async ({ page }) => {
    await stubCadastre(page)
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard/jardin')

    await page.getByRole('button', { name: /Retrouver mon terrain sur le cadastre/ }).click()
    await expect(page.getByText('Autour de 3 allée des Cerisiers')).toBeVisible()

    await page.getByRole('button', { name: "Changer d'adresse" }).click()

    await expect(page.getByText('Où est ton jardin ?')).toBeVisible()
    // Le champ repart de l'adresse cherchée, prête à être corrigée…
    await expect(page.getByRole('combobox')).toHaveValue('3 allée des Cerisiers')
    // … et sa liste de suggestions ne s'ouvre pas d'elle-même par-dessus le
    // pied du dialogue : elle attend une frappe.
    await expect(page.getByRole('listbox')).toHaveCount(0)
  })

  test('E2E-CAD-05 — Échap ferme le dialogue sans rien écrire dans le plan', async ({ page }) => {
    await stubCadastre(page)
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard/jardin')

    await page.getByRole('button', { name: /Retrouver mon terrain sur le cadastre/ }).click()
    await expect(page.getByText('Laquelle est ta parcelle ?')).toBeVisible()

    await page.keyboard.press('Escape')

    await expect(page.getByRole('dialog')).toHaveCount(0)
    const plan = page.getByRole('table', { name: 'Éléments dans ton jardin' })
    await expect(plan.getByRole('cell', { name: 'terrain', exact: true })).toHaveCount(0)
    const garden = await prisma.garden.findUnique({ where: { id: gardenId } })
    expect(garden?.canvasData ?? '').not.toContain('"type":"terrain"')
  })

  test('E2E-CAD-04 — Un balcon n’a pas de parcelle : aucun bouton', async ({ page }) => {
    await prisma.garden.update({ where: { id: gardenId }, data: { type: 'BALCONY' } })
    await stubCadastre(page)
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    await page.goto('/dashboard/jardin')

    await expect(page.getByText('Étape 1 · Le terrain')).toBeVisible({ timeout: 30_000 })
    await expect(
      page.getByRole('button', { name: /Retrouver mon terrain sur le cadastre/ }),
    ).toHaveCount(0)
  })
})
