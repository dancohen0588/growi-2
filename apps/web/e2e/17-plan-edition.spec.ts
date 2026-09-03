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
 * Édition du plan : navigation, formes et ajout d'éléments.
 *
 * Le plan est dessiné en canvas — rien n'y est inspectable depuis le DOM. Deux
 * observatoires servent ici : la table accessible du canevas, qui liste type et
 * position de chaque élément, et le `canvasData` enregistré en base.
 */

let gardenId: string

const CONFIG = {
  orientation: 'S',
  compassDeg: 180,
  solType: 'argileux',
  slopeDeg: 0,
  slopeDirection: 'N',
  microclimats: [],
  widthMeters: 10,
  heightMeters: 15,
  climateZone: 'oceanique',
}

/** Un mur rectangulaire de 200 × 120, posé en (200, 200) — repères ronds. */
const MUR = {
  id: 'mur-1',
  type: 'mur',
  emoji: '🧱',
  label: 'Mur',
  x: 200,
  y: 200,
  width: 200,
  height: 120,
  rotation: 0,
  sun: 'full',
  points: [
    { x: 0, y: 0 },
    { x: 200, y: 0 },
    { x: 200, y: 120 },
    { x: 0, y: 120 },
  ],
}

/** Un terrain de 60 × 50 m à l'échelle par défaut : 2 400 × 2 000 px. */
const GRAND_TERRAIN = {
  ...MUR,
  id: 'terrain-1',
  type: 'terrain',
  emoji: '🗺️',
  label: 'Limite de parcelle · 0A 1948',
  x: 40,
  y: 40,
  width: 2400,
  height: 2000,
  drawKind: 'terrain',
  points: [
    { x: 0, y: 0 },
    { x: 2400, y: 0 },
    { x: 2400, y: 2000 },
    { x: 0, y: 2000 },
  ],
}

async function setPlan(elements: unknown[]) {
  await prisma.garden.update({
    where: { id: gardenId },
    data: {
      canvasData: JSON.stringify({
        id: 'main',
        name: 'Jardin E2E',
        elements,
        config: CONFIG,
        onboarding: { completed: true },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }),
    },
  })
}

async function savedElements(): Promise<Array<Record<string, never> & {
  id: string; type: string; x: number; y: number; width: number; height: number
  points?: Array<{ x: number; y: number }>
}>> {
  const garden = await prisma.garden.findUnique({ where: { id: gardenId } })
  return garden?.canvasData ? JSON.parse(garden.canvasData).elements : []
}

/**
 * Ouvre l'éditeur.
 *
 * `expectedType` fait attendre que **ce** plan soit affiché, et pas seulement
 * la page : le canevas apparaît vide le temps que le jardin soit chargé, et
 * agir dans cet intervalle donnerait des mesures fausses.
 */
async function openEditor(page: Page, expectedType?: string) {
  await page.setViewportSize({ width: 1440, height: 900 })
  await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
  await page.goto('/dashboard/jardin')
  await expect(page.locator('#garden-canvas-droppable')).toBeVisible({ timeout: 60_000 })
  if (expectedType) {
    await expect(
      page.getByRole('cell', { name: expectedType, exact: true }),
    ).toBeVisible({ timeout: 60_000 })
    await page.waitForTimeout(500)
  } else {
    // Plan vide : rien à attendre dans la table, on laisse le chargement finir.
    await page.waitForTimeout(2_000)
  }
  return (await page.locator('#garden-canvas-droppable').boundingBox())!
}

/**
 * Un glissé lent, en plusieurs étapes : Konva comme dnd-kit démarrent au
 * premier mouvement et mesurent leurs cibles en cours de route.
 */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 8 })
  await page.waitForTimeout(150)
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.waitForTimeout(150)
  await page.mouse.up()
}

/**
 * Attend que le plan enregistré satisfasse `check`.
 *
 * L'enregistrement est différé de 1,5 s côté client, puis part au serveur :
 * une attente fixe rend le test instable, la relance jusqu'à satisfaction non.
 */
async function expectSaved(
  check: (elements: Awaited<ReturnType<typeof savedElements>>) => void,
) {
  await expect(async () => check(await savedElements())).toPass({ timeout: 25_000 })
}

/** Sélectionne l'élément sous ce point, en s'assurant que la sélection a pris. */
async function selectAt(page: Page, x: number, y: number) {
  const placeholder = page.getByText('Clique sur un élément pour modifier ses propriétés')
  await expect(async () => {
    await page.mouse.click(x, y)
    await expect(placeholder).toHaveCount(0, { timeout: 2_000 })
  }).toPass({ timeout: 20_000 })
}

const zoomLevel = (page: Page) => page.locator('[aria-label="Niveau de zoom"]')

test.beforeAll(async () => {
  gardenId = (await seedTestUser()).gardenId!
})

test.afterAll(async () => {
  await cleanupTestData()
})

// ─── Navigation ────────────────────────────────────────────────────────────

test.describe('Navigation dans le plan', () => {
  test('E2E-PLAN-10 — Un grand terrain tient à l’écran', async ({ page }) => {
    await setPlan([GRAND_TERRAIN])
    await openEditor(page, 'terrain')

    // 40 % ne suffisait pas pour 2 400 px de large dans un canevas de 620.
    const zoomOut = page.getByRole('button', { name: 'Zoom arrière' })
    for (let i = 0; i < 15 && (await zoomOut.isEnabled()); i++) await zoomOut.click()
    await expect(zoomLevel(page)).toHaveText('10%')

    // « Tout voir » cadre le plan entier d'un coup.
    await page.getByRole('button', { name: 'Voir tout le plan' }).click()
    const fitted = Number((await zoomLevel(page).textContent())!.replace('%', ''))
    expect(fitted).toBeGreaterThan(10)
    expect(fitted).toBeLessThan(40)
  })

  test('E2E-PLAN-11 — « Tout voir » ne grossit pas un petit plan', async ({ page }) => {
    await setPlan([MUR])
    await openEditor(page, 'mur')

    await page.getByRole('button', { name: 'Voir tout le plan' }).click()

    await expect(zoomLevel(page)).toHaveText('100%')
  })

  test('E2E-PLAN-12 — Le mode déplacement ne bouge aucun élément', async ({ page }) => {
    await setPlan([MUR])
    const box = await openEditor(page, 'mur')

    await page.getByRole('button', { name: 'Déplacer le plan sans rien bouger' }).click()
    // Le glissé part du centre du mur : sans ce mode, il l'emporterait.
    await drag(
      page,
      { x: box.x + 300, y: box.y + 260 },
      { x: box.x + 450, y: box.y + 380 },
    )
    await page.waitForTimeout(3_000)

    const [mur] = await savedElements()
    expect({ x: mur.x, y: mur.y }).toEqual({ x: 200, y: 200 })
  })

  test('E2E-PLAN-13 — Le plan s’ouvre et se referme en plein écran', async ({ page }) => {
    await setPlan([MUR])
    await openEditor(page, 'mur')

    await page.getByRole('button', { name: 'Plein écran' }).click()
    await expect(async () => {
      expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(true)
    }).toPass({ timeout: 5_000 })

    await page.getByRole('button', { name: 'Quitter le plein écran' }).click()
    await expect(async () => {
      expect(await page.evaluate(() => Boolean(document.fullscreenElement))).toBe(false)
    }).toPass({ timeout: 5_000 })
  })
})

// ─── Formes ────────────────────────────────────────────────────────────────

test.describe('Édition des formes', () => {
  test('E2E-PLAN-14 — Tirer un coin redimensionne le rectangle', async ({ page }) => {
    await setPlan([MUR])
    const box = await openEditor(page, 'mur')

    // Les poignées n'existent qu'une fois l'élément sélectionné.
    await selectAt(page, box.x + 300, box.y + 260)
    // Glissé de la poignée du coin bas-droit, de (400, 320) à (500, 420).
    await drag(page, { x: box.x + 400, y: box.y + 320 }, { x: box.x + 500, y: box.y + 420 })

    await expectSaved(([mur]) => {
      // Le coin opposé n'a pas bougé, la boîte a suivi le coin tiré…
      expect({ x: mur.x, y: mur.y }).toEqual({ x: 200, y: 200 })
      expect({ width: mur.width, height: mur.height }).toEqual({ width: 300, height: 220 })
      // … et la forme est restée un rectangle, pas un quadrilatère quelconque.
      expect(mur.points).toEqual([
        { x: 0, y: 0 },
        { x: 300, y: 0 },
        { x: 300, y: 220 },
        { x: 0, y: 220 },
      ])
    })
  })
})

// ─── Ajout d'un élément ────────────────────────────────────────────────────

test.describe('Ajout d’un élément', () => {
  test('E2E-PLAN-15 — Un élément déposé apparaît sous le curseur', async ({ page }) => {
    await setPlan([])
    const box = await openEditor(page)

    const cible = { x: box.x + 400, y: box.y + 300 }
    const depart = (await page.locator('[aria-label^="Glisser Mur"]').boundingBox())!

    // Le glissé est relancé tant qu'il n'a rien posé : dnd-kit mesure sa cible
    // en cours de geste, et un premier essai peut passer à côté.
    await expect(async () => {
      await page.mouse.move(depart.x + depart.width / 2, depart.y + depart.height / 2)
      await page.mouse.down()
      for (const point of [
        { x: depart.x + 20, y: depart.y + 20 },
        { x: box.x + 150, y: box.y + 150 },
        cible,
      ]) {
        await page.mouse.move(point.x, point.y, { steps: 6 })
        await page.waitForTimeout(120)
      }
      await page.mouse.up()
      await expect(
        page.getByRole('cell', { name: 'mur', exact: true }),
      ).toBeVisible({ timeout: 2_000 })
    }).toPass({ timeout: 40_000 })

    await expectSaved(elements => {
      const pose = elements[elements.length - 1]
      expect(pose.type).toBe('mur')
      // Plan à l'échelle 1 et non déplacé : monde = écran − origine du canevas.
      // L'écart toléré est celui de la grille d'accrochage, 20 px.
      expect(Math.abs(pose.x + pose.width / 2 - 400)).toBeLessThanOrEqual(20)
      expect(Math.abs(pose.y + pose.height / 2 - 300)).toBeLessThanOrEqual(20)
    })
  })

  test('E2E-PLAN-16 — Le double-clic pose l’élément au centre de la vue', async ({ page }) => {
    await setPlan([])
    const box = await openEditor(page)

    await page.locator('[aria-label^="Glisser Terrasse"]').dblclick()

    await expectSaved(([pose]) => {
      expect(pose.type).toBe('terrasse')
      expect(Math.abs(pose.x + pose.width / 2 - box.width / 2)).toBeLessThanOrEqual(20)
      expect(Math.abs(pose.y + pose.height / 2 - box.height / 2)).toBeLessThanOrEqual(20)
    })
  })

  test('E2E-PLAN-17 — Un élément ajouté passe au premier plan', async ({ page }) => {
    // Une zone partait au fond des calques, donc sous un plan déjà rempli.
    await setPlan([MUR])
    await openEditor(page, 'mur')

    // La section « Zones » est repliée par défaut.
    await page.getByRole('button', { name: 'Zones', exact: true }).click()
    await page.locator('[aria-label^="Glisser Pelouse"]').dblclick()

    // L'ordre du tableau porte l'empilement : la pelouse est en dernier, donc
    // au-dessus du mur — elle partait au fond des calques avant.
    await expectSaved(elements => {
      expect(elements.map(el => el.type)).toEqual(['mur', 'pelouse'])
    })
  })
})
