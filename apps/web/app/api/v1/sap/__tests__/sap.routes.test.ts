import { beforeEach, describe, expect, it, vi } from 'vitest'

// Les routes de la sève ne décident rien : elles authentifient, valident et
// transmettent. Ce qui est vérifié ici, c'est ce qui sort — jamais l'identifiant
// d'un geste ni celui du compte — et les statuts que le mobile lit.

const authContext = vi.hoisted(() => ({ requireUserId: vi.fn() }))
const sapService = vi.hoisted(() => ({
  listSapHistory: vi.fn(),
  giveSapDrop: vi.fn(),
}))
const rewardsService = vi.hoisted(() => ({ getSapOverview: vi.fn(), setHomeTheme: vi.fn() }))

vi.mock('@/lib/api/auth-context', () => authContext)
vi.mock('@/lib/services/sap.service', () => sapService)
vi.mock('@/lib/services/sap-rewards.service', () => rewardsService)

const summaryRoute = await import('../route')
const historyRoute = await import('../history/route')
const giftsRoute = await import('../gifts/route')
const themeRoute = await import('../theme/route')
const { ServiceError } = await import('@/lib/services/errors')

const CREATED_AT = new Date('2026-11-06T09:30:00Z')

/** Une ligne telle que Prisma la rend — avec ses colonnes internes. */
function entryRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    userId: 'u1',
    kind: 'task_on_time',
    amount: 2,
    sourceId: 'task_secret_id',
    day: '2026-11-06',
    label: 'Pailler à temps',
    createdAt: CREATED_AT,
    ...overrides,
  }
}

function post(body: unknown) {
  return new Request('https://growi.test/api/v1/sap/gifts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  authContext.requireUserId.mockResolvedValue('u1')
})

describe('GET /api/v1/sap', () => {
  it('rend le résumé, gains sérialisés champ par champ', async () => {
    rewardsService.getSapOverview.mockResolvedValue({
      total: 340,
      rings: { count: 3, floor: 300, next: 500, progress: 0.2, remaining: 160 },
      giftsLeft: 2,
      giftsPerWeek: 3,
      recent: [entryRow()],
      rewards: [
        { ring: 1, kind: 'secret', value: 'purin-ortie', title: 'Le purin d’ortie', createdAt: CREATED_AT },
        { ring: 2, kind: 'theme', value: 'sous-bois', title: 'Sous-bois', createdAt: CREATED_AT },
      ],
      homeTheme: 'sous-bois',
    })

    const response = await summaryRoute.GET()
    const { data } = await response.json()

    expect(response.status).toBe(200)
    expect(rewardsService.getSapOverview).toHaveBeenCalledWith('u1')
    expect(data).toMatchObject({ total: 340, giftsLeft: 2, rings: { count: 3 } })
    expect(data.recent).toEqual([
      { id: 'e1', kind: 'task_on_time', amount: 2, label: 'Pailler à temps', createdAt: CREATED_AT.toISOString() },
    ])
    expect(data.homeTheme).toBe('sous-bois')
    expect(data.rewards[1]).toEqual({
      ring: 2,
      kind: 'theme',
      value: 'sous-bois',
      title: 'Sous-bois',
      createdAt: CREATED_AT.toISOString(),
    })
    // Rien d'interne ne sort, ni dans le résumé ni en cache.
    expect(response.headers.get('cache-control')).toMatch(/no-store/)
  })

  it('401 sans session', async () => {
    authContext.requireUserId.mockRejectedValue(new ServiceError('UNAUTHENTICATED', 'Authentification requise'))
    const response = await summaryRoute.GET()
    expect(response.status).toBe(401)
    expect(rewardsService.getSapOverview).not.toHaveBeenCalled()
  })
})

describe('GET /api/v1/sap/history', () => {
  it('transmet le curseur et sérialise la page', async () => {
    sapService.listSapHistory.mockResolvedValue({ items: [entryRow({ id: 'e2' })], nextCursor: 'abc' })

    const response = await historyRoute.GET(new Request('https://growi.test/api/v1/sap/history?cursor=xyz'))
    const { data } = await response.json()

    expect(sapService.listSapHistory).toHaveBeenCalledWith('u1', 'xyz')
    expect(data.nextCursor).toBe('abc')
    expect(data.items[0]).not.toHaveProperty('sourceId')
    expect(data.items[0]).not.toHaveProperty('userId')
  })

  it('sans curseur, la première page', async () => {
    sapService.listSapHistory.mockResolvedValue({ items: [], nextCursor: null })
    await historyRoute.GET(new Request('https://growi.test/api/v1/sap/history'))
    expect(sapService.listSapHistory).toHaveBeenCalledWith('u1', null)
  })
})

describe('POST /api/v1/sap/gifts', () => {
  it('201 et le nombre de gouttes qu’il reste', async () => {
    sapService.giveSapDrop.mockResolvedValue({ giftsLeft: 2 })

    const response = await giftsRoute.POST(post({ handle: 'Camille', reason: 'bouture', postId: 'post_1' }))

    expect(response.status).toBe(201)
    expect((await response.json()).data).toEqual({ giftsLeft: 2 })
    // Le pseudo arrive normalisé au service, comme partout dans la Communauté.
    expect(sapService.giveSapDrop).toHaveBeenCalledWith('u1', {
      handle: 'camille',
      reason: 'bouture',
      postId: 'post_1',
    })
  })

  it('400 pour un motif inconnu, sans rien offrir', async () => {
    const response = await giftsRoute.POST(post({ handle: 'camille', reason: 'argent' }))
    expect(response.status).toBe(400)
    expect(sapService.giveSapDrop).not.toHaveBeenCalled()
  })

  it.each([
    ['FORBIDDEN', 403],
    ['NOT_FOUND', 404],
    ['QUOTA_EXCEEDED', 429],
  ] as const)('%s du service → %i', async (code, status) => {
    sapService.giveSapDrop.mockRejectedValue(new ServiceError(code, 'message à afficher'))

    const response = await giftsRoute.POST(post({ handle: 'camille', reason: 'aide' }))

    expect(response.status).toBe(status)
    expect((await response.json()).error).toEqual({ code, message: 'message à afficher' })
  })
})

describe('PUT /api/v1/sap/theme', () => {
  function put(body: unknown) {
    return new Request('https://growi.test/api/v1/sap/theme', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
  }

  it('choisit un thème débloqué', async () => {
    rewardsService.setHomeTheme.mockResolvedValue('prairie')
    const response = await themeRoute.PUT(put({ theme: 'prairie' }))
    expect(response.status).toBe(200)
    expect((await response.json()).data).toEqual({ homeTheme: 'prairie' })
    expect(rewardsService.setHomeTheme).toHaveBeenCalledWith('u1', 'prairie')
  })

  it('null revient au classique', async () => {
    rewardsService.setHomeTheme.mockResolvedValue(null)
    await themeRoute.PUT(put({ theme: null }))
    expect(rewardsService.setHomeTheme).toHaveBeenCalledWith('u1', null)
  })

  it('400 pour un thème inconnu, sans rien écrire', async () => {
    const response = await themeRoute.PUT(put({ theme: 'jungle' }))
    expect(response.status).toBe(400)
    expect(rewardsService.setHomeTheme).not.toHaveBeenCalled()
  })

  it('403 pour un thème pas encore débloqué', async () => {
    rewardsService.setHomeTheme.mockRejectedValue(new ServiceError('FORBIDDEN', 'Pas encore'))
    const response = await themeRoute.PUT(put({ theme: 'crepuscule' }))
    expect(response.status).toBe(403)
  })
})
