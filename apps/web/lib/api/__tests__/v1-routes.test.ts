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
  logWatering: vi.fn(),
  logPruning: vi.fn(),
  logFertilizing: vi.fn(),
  logHealth: vi.fn(),
}))

vi.mock('@/lib/api/auth-context', () => ({ requireUserId, getUserId: vi.fn() }))
vi.mock('@/lib/services/garden.service', () => gardenService)
vi.mock('@/lib/services/log.service', () => logService)

const { GET: listGardens, POST: createGarden } = await import('@/app/api/v1/gardens/route')
const { GET: getGarden } = await import('@/app/api/v1/gardens/[id]/route')
const { POST: createLog } = await import('@/app/api/v1/plants/[id]/logs/route')

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

  it('enregistre un arrosage et répond 201', async () => {
    logService.logWatering.mockResolvedValue({
      id: 'log_1',
      plantInstanceId: 'plant_1',
      wateredAt: NOW,
      note: 'copieux',
    })

    const res = await createLog(jsonRequest({ type: 'watering', note: 'copieux' }), context)
    const body = await res.json()

    expect(res.status).toBe(201)
    expect(logService.logWatering).toHaveBeenCalledWith('plant_1', USER_ID, {
      note: 'copieux',
      wateredAt: undefined,
    })
    expect(body.data).toEqual({
      type: 'watering',
      log: {
        id: 'log_1',
        plantInstanceId: 'plant_1',
        wateredAt: '2026-08-15T09:00:00.000Z',
        note: 'copieux',
      },
    })
  })

  it('aiguille vers le bon service selon le type', async () => {
    logService.logHealth.mockResolvedValue({
      id: 'log_2',
      plantInstanceId: 'plant_1',
      status: 'WARNING',
      note: null,
      photoUrl: null,
      loggedAt: NOW,
    })

    const res = await createLog(jsonRequest({ type: 'health', status: 'WARNING' }), context)

    expect(res.status).toBe(201)
    expect(logService.logHealth).toHaveBeenCalledWith('plant_1', USER_ID, 'WARNING', {
      note: undefined,
      photoUrl: undefined,
      loggedAt: undefined,
    })
    expect(logService.logWatering).not.toHaveBeenCalled()
  })

  it('refuse une note de santé sans statut', async () => {
    const res = await createLog(jsonRequest({ type: 'health' }), context)

    expect(res.status).toBe(400)
    expect(logService.logHealth).not.toHaveBeenCalled()
  })

  it('refuse un type d\'intervention inconnu', async () => {
    const res = await createLog(jsonRequest({ type: 'rempotage' }), context)

    expect(res.status).toBe(400)
  })

  it('traduit une plante non possédée en 404', async () => {
    logService.logWatering.mockRejectedValue(
      new ServiceError('NOT_FOUND', 'Plante introuvable'),
    )

    const res = await createLog(jsonRequest({ type: 'watering' }), context)
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.error.code).toBe('NOT_FOUND')
  })

  it('ne laisse pas fuiter le détail d\'une erreur inattendue', async () => {
    logService.logWatering.mockRejectedValue(new Error('connexion Prisma perdue'))
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
