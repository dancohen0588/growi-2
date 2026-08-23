import { test, expect } from '@playwright/test'
import {
  cleanupTestData,
  loginAs,
  prisma,
  seedTestUser,
  seedTestUser2,
  TEST_EMAIL,
  TEST_EMAIL_2,
  TEST_PASSWORD,
} from './fixtures'

// Le plan dessiné, servi en SVG à l'app mobile qui ne peut que le consulter.

let gardenId: string
let otherGardenId: string

const CANVAS = JSON.stringify({
  id: 'main',
  name: 'Mon jardin',
  config: { widthMeters: 10, heightMeters: 15 },
  elements: [
    {
      id: 'pelouse-1', type: 'pelouse', emoji: '🌱', label: 'Pelouse',
      x: 40, y: 40, width: 240, height: 180, rotation: 0, sun: 'full',
    },
    {
      id: 'tomate-1', type: 'plante', emoji: '🍅', label: 'Tomate',
      x: 300, y: 60, width: 60, height: 60, rotation: 15, sun: 'full',
    },
  ],
})

test.beforeAll(async () => {
  gardenId = (await seedTestUser()).gardenId!
  otherGardenId = (await seedTestUser2()).gardenId!
  await prisma.garden.update({ where: { id: gardenId }, data: { canvasData: CANVAS } })
})

test.afterAll(async () => {
  await cleanupTestData()
})

test.describe('Plan du jardin', () => {
  test('E2E-PLAN-01 — Sans authentification → 401', async ({ request }) => {
    const res = await request.get(`/api/v1/gardens/${gardenId}/plan`)
    expect(res.status()).toBe(401)
    expect((await res.json()).error).toMatchObject({ code: 'UNAUTHENTICATED' })
  })

  test('E2E-PLAN-02 — Le plan est servi en SVG dimensionné', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)

    const res = await page.request.get(`/api/v1/gardens/${gardenId}/plan`)
    expect(res.status()).toBe(200)

    const { data } = await res.json()
    expect(data.elementCount).toBe(2)
    expect(data.svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true)
    expect(data.svg).toContain(`viewBox="0 0 ${data.width} ${data.height}"`)

    // La zone est nommée, la plante non — sinon un potager devient illisible.
    expect(data.svg).toContain('>Pelouse</text>')
    expect(data.svg).not.toContain('>Tomate</text>')

    // Les identifiants sont préfixés par élément : aucun doublon dans le document.
    const ids = [...String(data.svg).matchAll(/\sid="([^"]+)"/g)].map(m => m[1])
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('E2E-PLAN-03 — Le plan d\'un autre compte est introuvable', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)

    const res = await page.request.get(`/api/v1/gardens/${otherGardenId}/plan`)
    expect(res.status()).toBe(404)
  })

  test('E2E-PLAN-04 — Un jardin sans plan répond 404, pas un SVG vide', async ({ page }) => {
    await prisma.garden.update({ where: { id: gardenId }, data: { canvasData: null } })
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)

    const res = await page.request.get(`/api/v1/gardens/${gardenId}/plan`)
    expect(res.status()).toBe(404)
    expect((await res.json()).error).toMatchObject({ code: 'NOT_FOUND' })

    await prisma.garden.update({ where: { id: gardenId }, data: { canvasData: CANVAS } })
  })

  test('E2E-PLAN-05 — Le SVG rendu par un navigateur ne produit aucune erreur', async ({
    page,
  }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    const { data } = await (await page.request.get(`/api/v1/gardens/${gardenId}/plan`)).json()

    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))

    await page.setContent(`<!doctype html><html><body>${data.svg}</body></html>`)

    // `.first()` : chaque élément du plan est lui-même un `<svg>` imbriqué,
    // le sélecteur en trouve donc autant que d'éléments dessinés.
    const box = await page.locator('svg').first().boundingBox()
    expect(box?.width).toBeGreaterThan(0)
    expect(box?.height).toBeGreaterThan(0)

    // Et chaque référence interne trouve sa cible.
    const dangling = await page.evaluate(() => {
      const svg = document.querySelector('svg')!
      const refs = [...svg.innerHTML.matchAll(/url\(#([^)]+)\)/g)].map(m => m[1])
      return refs.filter(id => !svg.querySelector(`#${CSS.escape(id)}`))
    })
    expect(dangling).toEqual([])
    expect(errors).toEqual([])
  })
})
