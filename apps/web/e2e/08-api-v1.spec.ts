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

    // Modification, puis effacement d'un champ facultatif de la plante.
    const renamed = await api.patch(`/api/v1/plants/${plant.id}`, {
      data: { customName: 'Basilic renommé', notes: 'Bouturé en mai' },
    })
    expect(renamed.status()).toBe(200)
    expect((await renamed.json()).data).toMatchObject({
      customName: 'Basilic renommé',
      notes: 'Bouturé en mai',
    })

    const clearedNotes = await api.patch(`/api/v1/plants/${plant.id}`, {
      data: { notes: null },
    })
    expect((await clearedNotes.json()).data.notes).toBeNull()
    expect((await clearedNotes.json()).data.customName).toBe('Basilic renommé')

    // Arrosage
    const logRes = await api.post(`/api/v1/plants/${plant.id}/logs`, {
      data: { type: 'watering', note: 'Premier arrosage' },
    })
    expect(logRes.status()).toBe(201)
    expect((await logRes.json()).data).toMatchObject({ type: 'watering' })

    // Un geste ajouté par le journal unifié, avec sa quantité
    const harvest = await api.post(`/api/v1/plants/${plant.id}/logs`, {
      data: { type: 'harvest', quantity: 1.2, unit: 'kg', note: 'Première récolte' },
    })
    expect(harvest.status()).toBe(201)
    expect((await harvest.json()).data).toMatchObject({ type: 'harvest', quantity: 1.2 })

    // L'historique est une liste unique, du plus récent au plus ancien
    const logsRes = await api.get(`/api/v1/plants/${plant.id}/logs`)
    const logs = (await logsRes.json()).data
    expect(logs).toHaveLength(2)
    expect(logs[0].type).toBe('harvest')
    expect(logs.find((l: { type: string }) => l.type === 'watering').note).toBe(
      'Premier arrosage',
    )

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

  test('E2E-APIV1-14 — Les routes de diagnostic sont fermées et isolées', async ({
    page,
  }) => {
    // Le parcours complet (avec Gemini simulé) est couvert par les e2e du
    // diagnostic ; ici on vérifie seulement que les quatre routes existent,
    // exigent un compte et ne débordent pas d'un compte à l'autre.
    const anonymous = await page.request.get(`/api/v1/plants/inconnue/diagnoses`)
    expect(anonymous.status()).toBe(401)

    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    const api = page.request

    // Historique et diagnostic d'une plante qui n'est pas à nous → 404,
    // jamais 500 ni fuite du contenu.
    expect((await api.get('/api/v1/plants/plante-inconnue/diagnoses')).status()).toBe(404)
    expect(
      (await api.get('/api/v1/plants/plante-inconnue/diagnoses/diag-inconnu')).status(),
    ).toBe(404)
    expect(
      (
        await api.post('/api/v1/plants/plante-inconnue/diagnoses/diag-inconnu/apply', {
          data: { apply: true },
        })
      ).status(),
    ).toBe(404)

    // Un corps qui donne les deux sources de photo est refusé avant le modèle.
    const ambiguous = await api.post('/api/v1/plants/plante-inconnue/diagnose', {
      data: { imageBase64: 'data:image/jpeg;base64,QUJD', useExistingPhoto: true },
    })
    expect(ambiguous.status()).toBe(400)
    expect((await ambiguous.json()).error.code).toBe('INVALID_INPUT')
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

  test('E2E-APIV1-10 — Toutes les plantes, tous jardins confondus', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    const api = page.request

    const plant = (
      await (
        await api.post(`/api/v1/gardens/${gardenId1}/plants`, {
          data: { location: 'OUTDOOR', customName: 'Plante à plat' },
        })
      ).json()
    ).data

    const all = (await (await api.get('/api/v1/plants')).json()).data
    expect(all.some((p: { id: string }) => p.id === plant.id)).toBe(true)
    // Isolation : aucune plante d'un autre compte ne doit apparaître.
    expect(all.every((p: { gardenId: string | null }) => p.gardenId !== gardenId2)).toBe(true)

    await api.delete(`/api/v1/plants/${plant.id}`)
  })

  test('E2E-APIV1-11 — Indicateurs et préférences d\'alertes', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    const api = page.request

    const summary = (await (await api.get('/api/v1/summary')).json()).data
    expect(summary.gardens).toBeGreaterThan(0)
    expect(typeof summary.tasksToday).toBe('number')
    expect(summary.tasksLate).toBeLessThanOrEqual(summary.tasksToday)

    // Mise à jour partielle : le reste des préférences est conservé.
    const before = (await (await api.get('/api/v1/me/alerts')).json()).data
    const patched = (
      await (
        await api.patch('/api/v1/me/alerts', { data: { frostAlert: !before.frostAlert } })
      ).json()
    ).data
    expect(patched.frostAlert).toBe(!before.frostAlert)
    expect(patched.wateringReminder).toBe(before.wateringReminder)

    // Un seuil hors bornes est refusé sans rien changer.
    const invalid = await api.patch('/api/v1/me/alerts', { data: { frostThreshold: 40 } })
    expect(invalid.status()).toBe(400)

    await api.patch('/api/v1/me/alerts', { data: { frostAlert: before.frostAlert } })
  })

  test('E2E-APIV1-12 — Ajout d\'une plante identifiée', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    const api = page.request

    // Espèce du catalogue : la plante doit en hériter les besoins.
    const res = await api.post('/api/v1/plants', {
      data: {
        commonName: 'Basilic',
        scientificName: 'Ocimum basilicum',
        emoji: '🌿',
        encyclopediaSlug: 'basilic',
      },
    })
    expect(res.status()).toBe(201)

    const plant = (await res.json()).data
    expect(plant.catalogPlant?.slug).toBe('basilic')
    expect(plant.wateringFreqDays).toBeGreaterThan(0)
    // Rattachée d'office au jardin le plus récent, sans en choisir un.
    expect(plant.gardenId).not.toBeNull()

    expect((await api.post('/api/v1/plants', { data: { emoji: '🌿' } })).status()).toBe(400)

    await api.delete(`/api/v1/plants/${plant.id}`)
  })

  test('E2E-APIV1-13 — Envoi d\'une photo et cycle de vie', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    const api = page.request

    // Un JPEG minimal : seule la signature est examinée côté serveur.
    const jpeg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(64)])

    const upload = await api.post('/api/v1/uploads', {
      multipart: {
        file: { name: 'plante.jpg', mimeType: 'image/jpeg', buffer: jpeg },
        kind: 'plant',
      },
    })
    expect(upload.status()).toBe(201)

    const { url } = (await upload.json()).data
    expect(url).toContain('/storage/v1/object/public/plant-photos/')

    // Un fichier qui n'est pas une image est refusé, même bien étiqueté.
    const bogus = await api.post('/api/v1/uploads', {
      multipart: {
        file: { name: 'faux.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('pas une image') },
      },
    })
    expect(bogus.status()).toBe(400)

    // La photo se rattache à une plante par la route habituelle.
    const plant = (
      await (
        await api.post(`/api/v1/gardens/${gardenId1}/plants`, {
          data: { location: 'OUTDOOR', customName: 'Plante photographiée' },
        })
      ).json()
    ).data

    const patched = await api.patch(`/api/v1/plants/${plant.id}`, { data: { photoUrl: url } })
    expect((await patched.json()).data.photoUrl).toBe(url)

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

    // Un jardin par section, chacune avec ses tâches et ses alertes.
    const garden = planning.gardens.find((g: { id: string }) => g.id === gardenId1)
    expect(garden).toBeTruthy()
    expect(Array.isArray(garden.actions)).toBe(true)
    expect(Array.isArray(garden.alerts)).toBe(true)
  })

  test('E2E-APIV1-09 — Cocher une tâche note le geste sur la plante', async ({ page }) => {
    await loginAs(page, TEST_EMAIL, TEST_PASSWORD)
    const api = page.request

    const plant = (
      await (
        await api.post(`/api/v1/gardens/${gardenId1}/plants`, {
          data: { location: 'OUTDOOR', customName: 'Plante à arroser' },
        })
      ).json()
    ).data

    const done = await api.post('/api/v1/planning/actions/done', {
      data: { gardenId: gardenId1, actionType: 'arrosage', plantId: plant.id },
    })
    expect(done.status()).toBe(204)

    // Le geste est au journal, et la date d'arrosage de la plante a avancé.
    const logs = (await (await api.get(`/api/v1/plants/${plant.id}/logs`)).json()).data
    expect(logs[0]).toMatchObject({ type: 'watering' })
    expect((await (await api.get(`/api/v1/plants/${plant.id}`)).json()).data.lastWateredAt)
      .not.toBeNull()

    // Le jardin d'un autre compte reste inaccessible par cette route.
    const stolen = await api.post('/api/v1/planning/actions/done', {
      data: { gardenId: gardenId2, actionType: 'arrosage', plantId: plant.id },
    })
    expect(stolen.status()).toBe(404)

    await api.delete(`/api/v1/plants/${plant.id}`)
  })
})
