import { test, expect } from '@playwright/test'
import {
  loginAs,
  seedTestUser,
  seedTestUser2,
  cleanupTestData,
  TEST_EMAIL,
  TEST_PASSWORD,
} from './fixtures'

// Parcours complet de l'API v1 telle que l'app mobile la consommera :
// enveloppes { data } / { error }, codes HTTP, isolation entre comptes.

let gardenId1: string | null
let gardenId2: string | null

test.beforeAll(async () => {
  const data1 = await seedTestUser()
  gardenId1 = data1.gardenId
  const data2 = await seedTestUser2()
  gardenId2 = data2.gardenId
})

test.afterAll(async () => {
  await cleanupTestData()
})

test.describe('API v1', () => {
  test('E2E-APIV1-01 — Sans authentification → 401 avec enveloppe d\'erreur', async ({
    request,
  }) => {
    const res = await request.get('/api/v1/gardens')
    expect(res.status()).toBe(401)

    const body = await res.json()
    expect(body.error).toMatchObject({ code: 'UNAUTHENTICATED' })
    expect(body.data).toBeUndefined()
  })

  test('E2E-APIV1-02 — Cycle de vie jardin → plante → log', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    const api = page.request

    // Création
    const createRes = await api.post('/api/v1/gardens', {
      data: { name: 'Jardin API v1', type: 'BALCONY', surfaceM2: 8 },
    })
    expect(createRes.status()).toBe(201)
    const garden = (await createRes.json()).data
    expect(garden).toMatchObject({ name: 'Jardin API v1', type: 'BALCONY' })
    // Les dates sont sérialisées en ISO, pas en objets Date
    expect(garden.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    // Lecture dans la liste
    const listRes = await api.get('/api/v1/gardens')
    expect(listRes.status()).toBe(200)
    const gardens = (await listRes.json()).data
    expect(gardens.some((g: { id: string }) => g.id === garden.id)).toBe(true)

    // Mise à jour
    const patchRes = await api.patch(`/api/v1/gardens/${garden.id}`, {
      data: { name: 'Jardin API v1 renommé' },
    })
    expect(patchRes.status()).toBe(200)
    expect((await patchRes.json()).data.name).toBe('Jardin API v1 renommé')

    // `null` efface un champ facultatif, `undefined` le laisse inchangé.
    const cleared = await api.patch(`/api/v1/gardens/${garden.id}`, {
      data: { description: null },
    })
    expect(cleared.status()).toBe(200)
    const clearedGarden = (await cleared.json()).data
    expect(clearedGarden.description).toBeNull()
    expect(clearedGarden.name).toBe('Jardin API v1 renommé')

    // Ajout d'une plante dans ce jardin
    const plantRes = await api.post(`/api/v1/gardens/${garden.id}/plants`, {
      data: { location: 'BALCONY', customName: 'Basilic API', wateringFreqDays: 3 },
    })
    expect(plantRes.status()).toBe(201)
    const plant = (await plantRes.json()).data
    expect(plant).toMatchObject({ customName: 'Basilic API', gardenId: garden.id })

    // La plante apparaît dans le jardin
    const plantsRes = await api.get(`/api/v1/gardens/${garden.id}/plants`)
    expect(plantsRes.status()).toBe(200)
    expect((await plantsRes.json()).data).toHaveLength(1)

    // Arrosage
    const logRes = await api.post(`/api/v1/plants/${plant.id}/logs`, {
      data: { type: 'watering', note: 'Premier arrosage' },
    })
    expect(logRes.status()).toBe(201)
    expect((await logRes.json()).data).toMatchObject({ type: 'watering' })

    // Le log est dans l'historique et la plante porte la date d'arrosage
    const logsRes = await api.get(`/api/v1/plants/${plant.id}/logs`)
    const logs = (await logsRes.json()).data
    expect(logs.watering).toHaveLength(1)
    expect(logs.watering[0].note).toBe('Premier arrosage')
    expect(logs.pruning).toEqual([])

    const plantAfter = await api.get(`/api/v1/plants/${plant.id}`)
    expect((await plantAfter.json()).data.lastWateredAt).not.toBeNull()

    // Suppression
    expect((await api.delete(`/api/v1/plants/${plant.id}`)).status()).toBe(204)
    expect((await api.delete(`/api/v1/gardens/${garden.id}`)).status()).toBe(204)
    expect((await api.get(`/api/v1/gardens/${garden.id}`)).status()).toBe(404)
  })

  test('E2E-APIV1-03 — Validation du corps → 400', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)

    const res = await page.request.post('/api/v1/gardens', {
      data: { name: 'Toit', type: 'ROOFTOP' },
    })
    expect(res.status()).toBe(400)
    expect((await res.json()).error.code).toBe('INVALID_INPUT')
  })

  test('E2E-APIV1-04 — Isolation : le jardin d\'un autre compte est introuvable', async ({
    page,
  }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)

    expect((await page.request.get(`/api/v1/gardens/${gardenId2}`)).status()).toBe(404)
    expect((await page.request.get(`/api/v1/gardens/${gardenId2}/plants`)).status()).toBe(404)
    expect(
      (
        await page.request.patch(`/api/v1/gardens/${gardenId2}`, { data: { name: 'volé' } })
      ).status(),
    ).toBe(404)
  })

  test('E2E-APIV1-06 — Une plante ne peut pas être déplacée chez un autre', async ({
    page,
  }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    const api = page.request

    const plant = (
      await (
        await api.post(`/api/v1/gardens/${gardenId1}/plants`, {
          data: { location: 'OUTDOOR', customName: 'Plante IDOR' },
        })
      ).json()
    ).data

    // Rattacher sa propre plante au jardin d'un autre compte doit échouer.
    const moved = await api.patch(`/api/v1/plants/${plant.id}`, {
      data: { gardenId: gardenId2 },
    })
    expect(moved.status()).toBe(404)

    // La plante n'a pas bougé.
    const after = await api.get(`/api/v1/plants/${plant.id}`)
    expect((await after.json()).data.gardenId).toBe(gardenId1)

    await api.delete(`/api/v1/plants/${plant.id}`)
  })

  test('E2E-APIV1-08 — Recherche dans le catalogue', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)

    const res = await page.request.get('/api/v1/catalog?q=tomate')
    expect(res.status()).toBe(200)

    const results = (await res.json()).data
    expect(results.length).toBeGreaterThan(0)
    // Les champs dont l'autocomplétion mobile a besoin pour afficher un résultat.
    expect(results[0]).toMatchObject({
      commonName: expect.any(String),
      scientificName: expect.any(String),
      wateringFreqDays: expect.any(Number),
      toxic: expect.any(Boolean),
    })

    // Le catalogue est commun, mais la route reste authentifiée.
    expect((await page.request.get('/api/v1/catalog?q=x')).status()).toBe(200)
  })

  test('E2E-APIV1-07 — Les réponses authentifiées ne sont pas mises en cache', async ({
    page,
  }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)

    const res = await page.request.get('/api/v1/me')
    expect(res.headers()['cache-control']).toContain('no-store')
  })

  test('E2E-APIV1-05 — Profil et planning du jour', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    const api = page.request

    const meRes = await api.get('/api/v1/me')
    expect(meRes.status()).toBe(200)
    const me = (await meRes.json()).data
    expect(me.email).toBe(TEST_EMAIL)
    // Le mot de passe ne doit jamais transiter
    expect(JSON.stringify(me)).not.toContain('password')
    expect(me.alertConfig).toBeTruthy()

    const planningRes = await api.get('/api/v1/planning/today')
    expect(planningRes.status()).toBe(200)
    const planning = (await planningRes.json()).data
    expect(planning.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(Array.isArray(planning.actions)).toBe(true)
    expect(Array.isArray(planning.alerts)).toBe(true)
    expect(planning.garden?.id).toBe(gardenId1)
  })
})
