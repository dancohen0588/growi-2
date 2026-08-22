import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ServiceError } from '@/lib/services/errors'

// ─── Doublures ─────────────────────────────────────────────────────────────

const { requireUserId } = vi.hoisted(() => ({ requireUserId: vi.fn() }))
const gardenService = vi.hoisted(() => ({
  listGardens: vi.fn(),
  createGarden: vi.fn(),
  findGarden: vi.fn(),
  assertGardenOwned: vi.fn(),
  updateGarden: vi.fn(),
  deleteGarden: vi.fn(),
}))
const logService = vi.hoisted(() => ({
  listPlantLogs: vi.fn(),
  logCare: vi.fn(),
}))
const adviceService = vi.hoisted(() => ({ markActionDone: vi.fn() }))
const plantService = vi.hoisted(() => ({
  listPlantInstances: vi.fn(),
  addIdentifiedPlant: vi.fn(),
}))
const summaryService = vi.hoisted(() => ({ getDashboardSummary: vi.fn() }))
const gardenWeatherService = vi.hoisted(() => ({ getGardenWeather: vi.fn() }))
const userService = vi.hoisted(() => ({
  getAlertConfig: vi.fn(),
  updateAlertConfig: vi.fn(),
}))

vi.mock('@/lib/api/auth-context', () => ({ requireUserId, getUserId: vi.fn() }))
vi.mock('@/lib/services/garden.service', () => gardenService)
vi.mock('@/lib/services/log.service', () => logService)
vi.mock('@/lib/services/advice.service', () => adviceService)
vi.mock('@/lib/services/plant.service', () => plantService)
vi.mock('@/lib/services/summary.service', () => summaryService)
vi.mock('@/lib/services/garden-weather.service', () => gardenWeatherService)
vi.mock('@/lib/services/user.service', () => userService)

const { GET: listGardens, POST: createGarden } = await import('@/app/api/v1/gardens/route')
const { GET: getGarden } = await import('@/app/api/v1/gardens/[id]/route')
const { POST: createLog } = await import('@/app/api/v1/plants/[id]/logs/route')
const { POST: markDone } = await import('@/app/api/v1/planning/actions/done/route')
const { GET: listPlants, POST: addIdentifiedPlant } = await import('@/app/api/v1/plants/route')
const { GET: getSummary } = await import('@/app/api/v1/summary/route')
const { GET: getWeather } = await import('@/app/api/v1/weather/route')
const { PATCH: patchAlerts } = await import('@/app/api/v1/me/alerts/route')

// ─── Fixtures ──────────────────────────────────────────────────────────────

const USER_ID = 'user_1'
const NOW = new Date('2026-08-15T09:00:00.000Z')

const gardenRow = {
  id: 'garden_1',
  userId: USER_ID,
  name: 'Potager',
  description: null,
  type: 'OUTDOOR',
  surfaceM2: 12,
  climateZone: null,
  soilType: null,
  orientation: null,
  canvasData: null,
  createdAt: NOW,
  updatedAt: NOW,
}

function jsonRequest(body: unknown): Request {
  return new Request('http://localhost/api/v1/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  requireUserId.mockResolvedValue(USER_ID)
})

// ─── GET /api/v1/gardens ───────────────────────────────────────────────────

describe('GET /api/v1/gardens', () => {
  it('renvoie les jardins sérialisés dans une enveloppe { data }', async () => {
    gardenService.listGardens.mockResolvedValue([
      { ...gardenRow, zones: [], _count: { plantInstances: 3 } },
    ])

    const res = await listGardens()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(gardenService.listGardens).toHaveBeenCalledWith(USER_ID)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]).toMatchObject({
      id: 'garden_1',
      name: 'Potager',
      plantCount: 3,
      zones: [],
    })
  })

  it('sérialise les dates en chaînes ISO, pas en objets Date', async () => {
    gardenService.listGardens.mockResolvedValue([gardenRow])

    const res = await listGardens()
    const body = await res.json()

    expect(body.data[0].createdAt).toBe('2026-08-15T09:00:00.000Z')
  })

  it('répond 401 avec un code stable quand la requête est anonyme', async () => {
    requireUserId.mockRejectedValue(
      new ServiceError('UNAUTHENTICATED', 'Authentification requise'),
    )

    const res = await listGardens()
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body).toEqual({
      error: { code: 'UNAUTHENTICATED', message: 'Authentification requise' },
    })
    expect(gardenService.listGardens).not.toHaveBeenCalled()
  })
})

// ─── POST /api/v1/gardens ──────────────────────────────────────────────────

describe('POST /api/v1/gardens', () => {
  it('crée le jardin et répond 201', async () => {
    gardenService.createGarden.mockResolvedValue(gardenRow)

    const res = await createGarden(jsonRequest({ name: 'Potager', type: 'OUTDOOR' }))
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(gardenService.createGarden).toHaveBeenCalledWith(USER_ID, {
      name: 'Potager',
      type: 'OUTDOOR',
    })
    expect(body.data.id).toBe('garden_1')
  })

  it('rejette un type de jardin inconnu en 400 sans toucher au service', async () => {
    const res = await createGarden(jsonRequest({ name: 'Toit', type: 'ROOFTOP' }))
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.code).toBe('INVALID_INPUT')
    expect(gardenService.createGarden).not.toHaveBeenCalled()
  })

  it('rejette un corps absent en 400', async () => {
    const res = await createGarden(
      new Request('http://localhost/api/v1/gardens', { method: 'POST' }),
    )

    expect(res.status).toBe(400)
    expect(gardenService.createGarden).not.toHaveBeenCalled()
  })
})

// ─── GET /api/v1/gardens/[id] ──────────────────────────────────────────────

describe('GET /api/v1/gardens/[id]', () => {
  it('répond 404 quand le jardin est introuvable ou appartient à un autre', async () => {
    gardenService.findGarden.mockResolvedValue(null)

    const res = await getGarden(new Request('http://localhost/api/v1/gardens/x'), {
      params: { id: 'garden_autre' },
    })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error).toEqual({ code: 'NOT_FOUND', message: 'Jardin introuvable' })
  })
})

// ─── POST /api/v1/plants/[id]/logs ─────────────────────────────────────────

describe('POST /api/v1/plants/[id]/logs', () => {
  const context = { params: { id: 'plant_1' } }

  const storedLog = {
    id: 'log_1',
    plantInstanceId: 'plant_1',
    type: 'watering',
    occurredAt: NOW,
    note: 'copieux',
    productUsed: null,
    status: null,
    quantity: null,
    unit: null,
    photoUrl: null,
    createdAt: NOW,
  }

  it('enregistre un arrosage et répond 201', async () => {
    logService.logCare.mockResolvedValue(storedLog)

    const res = await createLog(jsonRequest({ type: 'watering', note: 'copieux' }), context)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(logService.logCare).toHaveBeenCalledWith('plant_1', USER_ID, {
      type: 'watering',
      note: 'copieux',
    })
    expect(body.data).toMatchObject({
      id: 'log_1',
      type: 'watering',
      occurredAt: '2026-08-15T09:00:00.000Z',
    })
  })

  it('transmet un geste ajouté par le journal unifié, avec sa quantité', async () => {
    logService.logCare.mockResolvedValue({
      ...storedLog,
      type: 'harvest',
      quantity: 1.2,
      unit: 'kg',
      note: null,
    })

    const res = await createLog(
      jsonRequest({ type: 'harvest', quantity: 1.2, unit: 'kg' }),
      context,
    )

    expect(res.status).toBe(201)
    expect(logService.logCare).toHaveBeenCalledWith('plant_1', USER_ID, {
      type: 'harvest',
      quantity: 1.2,
      unit: 'kg',
    })
  })

  it('refuse une note de santé sans statut', async () => {
    const res = await createLog(jsonRequest({ type: 'health' }), context)

    expect(res.status).toBe(400)
    expect(logService.logCare).not.toHaveBeenCalled()
  })

  it('refuse une quantité sans unité', async () => {
    const res = await createLog(jsonRequest({ type: 'harvest', quantity: 2 }), context)

    expect(res.status).toBe(400)
    expect(logService.logCare).not.toHaveBeenCalled()
  })

  it('refuse un type d\'intervention inconnu', async () => {
    const res = await createLog(jsonRequest({ type: 'bricolage' }), context)

    expect(res.status).toBe(400)
  })

  it('traduit une plante non possédée en 404', async () => {
    logService.logCare.mockRejectedValue(new ServiceError('NOT_FOUND', 'Plante introuvable'))

    const res = await createLog(jsonRequest({ type: 'watering' }), context)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('ne laisse pas fuiter le détail d\'une erreur inattendue', async () => {
    logService.logCare.mockRejectedValue(new Error('connexion Prisma perdue'))
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    const res = await createLog(jsonRequest({ type: 'watering' }), context)
    const body = await res.json()

    expect(res.status).toBe(500)
    expect(body.error).toEqual({
      code: 'INTERNAL',
      message: 'Une erreur interne est survenue.',
    })
    expect(JSON.stringify(body)).not.toContain('Prisma')
    consoleError.mockRestore()
  })
})

// ─── GET /api/v1/plants ────────────────────────────────────────────────────

describe('GET /api/v1/plants', () => {
  const plantRow = {
    id: 'plant_1',
    userId: USER_ID,
    gardenId: 'garden_1',
    zoneId: null,
    catalogPlantId: null,
    customName: 'Basilic',
    emoji: null,
    photoUrl: null,
    location: 'BALCONY',
    healthStatus: 'HEALTHY',
    dateAdded: NOW,
    createdAt: NOW,
    updatedAt: NOW,
    catalogPlant: null,
    zone: null,
  }

  it('renvoie les plantes de tous les jardins, sans filtre de jardin', async () => {
    plantService.listPlantInstances.mockResolvedValue([plantRow])

    const res = await listPlants()
    const body = await res.json()

    expect(res.status).toBe(200)
    // Un seul argument : le `userId`. Passer un `gardenId` restreindrait la liste.
    expect(plantService.listPlantInstances).toHaveBeenCalledWith(USER_ID)
    expect(body.data[0]).toMatchObject({ id: 'plant_1', customName: 'Basilic' })
    expect(body.data[0].dateAdded).toBe('2026-08-15T09:00:00.000Z')
  })

  it('répond 401 sans authentification, sans interroger le service', async () => {
    requireUserId.mockRejectedValue(
      new ServiceError('UNAUTHENTICATED', 'Authentification requise'),
    )

    const res = await listPlants()

    expect(res.status).toBe(401)
    expect(plantService.listPlantInstances).not.toHaveBeenCalled()
  })

  it('ajoute une plante identifiée et répond 201', async () => {
    plantService.addIdentifiedPlant.mockResolvedValue(plantRow)

    const res = await addIdentifiedPlant(
      jsonRequest({
        commonName: 'Basilic',
        scientificName: 'Ocimum basilicum',
        emoji: '🌿',
        encyclopediaSlug: 'basilic',
      }),
    )
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(plantService.addIdentifiedPlant).toHaveBeenCalledWith(USER_ID, {
      commonName: 'Basilic',
      scientificName: 'Ocimum basilicum',
      emoji: '🌿',
      encyclopediaSlug: 'basilic',
    })
    expect(body.data.id).toBe('plant_1')
  })

  it('refuse un ajout sans nom commun', async () => {
    const res = await addIdentifiedPlant(jsonRequest({ scientificName: 'Ocimum basilicum' }))

    expect(res.status).toBe(400)
    expect(plantService.addIdentifiedPlant).not.toHaveBeenCalled()
  })
})

// ─── GET /api/v1/summary ───────────────────────────────────────────────────

describe('GET /api/v1/summary', () => {
  it('renvoie les indicateurs de l\'accueil', async () => {
    summaryService.getDashboardSummary.mockResolvedValue({
      gardens: 2,
      plants: 7,
      plantsToWater: 3,
      tasksToday: 5,
      tasksLate: 1,
      tasksWeek: 4,
      alerts: 1,
      alertsHigh: 0,
      plantsWarning: 2,
      plantsCritical: 0,
    })

    const res = await getSummary()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(summaryService.getDashboardSummary).toHaveBeenCalledWith(USER_ID)
    expect(body.data).toMatchObject({ plants: 7, tasksLate: 1 })
  })

  it('répond 401 sans authentification', async () => {
    requireUserId.mockRejectedValue(
      new ServiceError('UNAUTHENTICATED', 'Authentification requise'),
    )

    expect((await getSummary()).status).toBe(401)
    expect(summaryService.getDashboardSummary).not.toHaveBeenCalled()
  })
})

// ─── GET /api/v1/weather ───────────────────────────────────────────────────

describe('GET /api/v1/weather', () => {
  it('renvoie la météo, son contexte et les conseils', async () => {
    gardenWeatherService.getGardenWeather.mockResolvedValue({
      locationName: 'Nantes',
      current: { temperature: 19 },
      forecast: [{ date: '2026-08-21' }],
      context: { wateringIndex: { score: 7 } },
      tips: ['Arrose en profondeur le matin.'],
    })

    const res = await getWeather()
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data.locationName).toBe('Nantes')
    expect(body.data.tips).toHaveLength(1)
  })

  it('traduit l\'absence de position en 400, pas en panne', async () => {
    gardenWeatherService.getGardenWeather.mockRejectedValue(
      new ServiceError('INVALID_INPUT', 'Renseigne ta position dans ton profil.'),
    )

    const res = await getWeather()
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.error.message).toContain('position')
  })
})

// ─── PATCH /api/v1/me/alerts ───────────────────────────────────────────────

describe('PATCH /api/v1/me/alerts', () => {
  it('transmet la mise à jour partielle au service', async () => {
    userService.updateAlertConfig.mockResolvedValue({ frostAlert: false })

    const res = await patchAlerts(jsonRequest({ frostAlert: false }))

    expect(res.status).toBe(200)
    expect(userService.updateAlertConfig).toHaveBeenCalledWith(USER_ID, { frostAlert: false })
  })

  it('rejette un seuil de gel hors bornes', async () => {
    const res = await patchAlerts(jsonRequest({ frostThreshold: 40 }))

    expect(res.status).toBe(400)
    expect(userService.updateAlertConfig).not.toHaveBeenCalled()
  })
})

// ─── POST /api/v1/planning/actions/done ────────────────────────────────────

describe('POST /api/v1/planning/actions/done', () => {
  it('coche la tâche et répond 204 sans corps', async () => {
    adviceService.markActionDone.mockResolvedValue(undefined)

    const res = await markDone(
      jsonRequest({ gardenId: 'garden_1', actionType: 'arrosage', plantId: 'plant_1' }),
    )

    expect(res.status).toBe(204)
    expect(adviceService.markActionDone).toHaveBeenCalledWith(USER_ID, {
      gardenId: 'garden_1',
      actionType: 'arrosage',
      plantId: 'plant_1',
    })
  })

  it('rejette un type de tâche inconnu sans toucher au service', async () => {
    const res = await markDone(jsonRequest({ gardenId: 'garden_1', actionType: 'bricolage' }))

    expect(res.status).toBe(400)
    expect(adviceService.markActionDone).not.toHaveBeenCalled()
  })

  it('traduit un jardin non possédé en 404', async () => {
    adviceService.markActionDone.mockRejectedValue(
      new ServiceError('NOT_FOUND', 'Jardin introuvable'),
    )

    const res = await markDone(jsonRequest({ gardenId: 'garden_autre', actionType: 'taille' }))

    expect(res.status).toBe(404)
    expect((await res.json()).error.code).toBe('NOT_FOUND')
  })
})
