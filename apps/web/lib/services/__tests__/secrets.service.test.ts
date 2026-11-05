import { beforeEach, describe, expect, it, vi } from 'vitest'

// Le secret de la semaine, ses suites et le grimoire, Prisma doublé. Le
// tirage lui-même est couvert par `lib/secrets/__tests__/select.test.ts`.

const prismaMock = vi.hoisted(() => ({
  gardenTip: { findMany: vi.fn(), findUnique: vi.fn() },
  gardenTipPick: { findUnique: vi.fn(), findFirst: vi.fn(), createMany: vi.fn() },
  userTip: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  careLog: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  plantInstance: { findMany: vi.fn() },
  user: { findUnique: vi.fn() },
}))
const analytics = vi.hoisted(() => ({ trackServer: vi.fn() }))
const weather = vi.hoisted(() => ({ fetchWeatherForecast: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/analytics/server', () => analytics)
vi.mock('@/lib/recommendation/weather-adapter', () => weather)

const service = await import('../secrets.service')

const USER = 'user_1'
const GARDEN = 'garden_1'
const TODAY = '2026-11-05' // un jeudi, semaine 2026-W45 (2 → 8 novembre)

function tipRow(slug: string, overrides: Record<string, unknown> = {}) {
  return {
    id: `tip_${slug}`,
    slug,
    title: `Titre ${slug}`,
    teaser: `Accroche ${slug}`,
    story: null,
    recipe: 'Étape 1\nÉtape 2',
    ingredients: ['feuilles mortes'],
    evidence: 'PROVEN',
    cautions: null,
    prepDays: 0,
    effortMinutes: 10,
    cooldownDays: 120,
    conditions: {},
    status: 'PUBLISHED',
    ...overrides,
  }
}

const ROSE = {
  id: 'p1',
  customName: null,
  emoji: '🌹',
  photoUrl: 'https://photo/p1.jpg',
  location: 'OUTDOOR',
  healthStatus: 'HEALTHY',
  catalogPlant: {
    commonName: 'Rosier',
    emoji: '🌹',
    imageUrl: null,
    category: 'FLOWERS',
    family: 'Rosaceae',
    scientificName: 'Rosa gallica',
    edible: false,
    toxic: false,
  },
}

function log(overrides: Record<string, unknown>) {
  return {
    id: 'log_1',
    plantInstanceId: 'p1',
    ruleId: 'r20-secret',
    tipSlug: 'feuilles-mortes',
    occurredAt: new Date('2026-10-20T10:00:00Z'),
    tipVerdict: null,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  service.forgetPublishedTips()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  prismaMock.gardenTip.findMany.mockResolvedValue([tipRow('feuilles-mortes')])
  prismaMock.gardenTip.findUnique.mockResolvedValue(null)
  prismaMock.user.findUnique.mockResolvedValue({ lunarCalendar: false, timezone: 'Europe/Paris' })
  prismaMock.plantInstance.findMany.mockResolvedValue([ROSE])
  prismaMock.gardenTipPick.findUnique.mockResolvedValue({ slug: 'feuilles-mortes', plantInstanceId: 'p1' })
  prismaMock.gardenTipPick.findFirst.mockResolvedValue(null)
  prismaMock.userTip.findMany.mockResolvedValue([])
  prismaMock.userTip.findFirst.mockResolvedValue(null)
  prismaMock.careLog.findMany.mockResolvedValue([])
})

describe('le secret de la semaine', () => {
  it('se présente comme une action à fenêtre sur la semaine, attachée à sa plante', async () => {
    const [action] = await service.secretActionsForGarden(USER, GARDEN, TODAY)

    expect(action).toEqual(
      expect.objectContaining({
        id: 'r20-secret:garden_1:2026-W45',
        type: 'autre',
        ruleId: 'r20-secret',
        plantId: 'p1',
        plantPhotoUrl: 'https://photo/p1.jpg',
        kind: 'window',
        window: { start: '2026-11-02', end: '2026-11-08' },
        dueDate: '2026-11-08',
        secret: expect.objectContaining({ slug: 'feuilles-mortes', stage: 'discover', evidence: 'PROVEN' }),
      }),
    )
  })

  it('est tiré puis figé quand la semaine n’en a pas encore', async () => {
    prismaMock.gardenTipPick.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ slug: 'feuilles-mortes', plantInstanceId: 'p1' })

    const actions = await service.secretActionsForGarden(USER, GARDEN, TODAY)

    expect(prismaMock.gardenTipPick.createMany).toHaveBeenCalledWith({
      data: [{ gardenId: GARDEN, week: '2026-W45', slug: 'feuilles-mortes', plantInstanceId: 'p1' }],
      skipDuplicates: true,
    })
    expect(actions).toHaveLength(1)
  })

  it('disparaît une fois essayé dans la semaine — même par une version de l’app qui ignore les secrets', async () => {
    prismaMock.careLog.findMany.mockResolvedValue([
      log({ occurredAt: new Date('2026-11-03T09:00:00Z'), tipSlug: null }),
    ])

    expect(await service.secretActionsForGarden(USER, GARDEN, TODAY)).toEqual([])
  })

  it('disparaît après « Pas pour moi »', async () => {
    prismaMock.userTip.findFirst.mockResolvedValue({ id: 'ut_1' })

    expect(await service.secretActionsForGarden(USER, GARDEN, TODAY)).toEqual([])
  })

  it('ne casse jamais le planning', async () => {
    prismaMock.plantInstance.findMany.mockRejectedValue(new Error('base muette'))

    expect(await service.secretActionsForGarden(USER, GARDEN, TODAY)).toEqual([])
  })

  it('n’est pas tiré pour un jardin vide', async () => {
    prismaMock.plantInstance.findMany.mockResolvedValue([])

    expect(await service.secretActionsForGarden(USER, GARDEN, TODAY)).toEqual([])
    expect(prismaMock.gardenTipPick.createMany).not.toHaveBeenCalled()
  })
})

describe('les suites d’un essai', () => {
  beforeEach(() => {
    prismaMock.gardenTipPick.findUnique.mockResolvedValue(null)
    prismaMock.gardenTip.findMany.mockResolvedValue([]) // aucun tirage : on ne regarde que les suites
  })

  it('annonce qu’une préparation est prête, le jour venu', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(tipRow('purin-ortie', { prepDays: 12 }))
    prismaMock.careLog.findMany.mockResolvedValue([log({ tipSlug: 'purin-ortie', occurredAt: new Date('2026-10-22T08:00:00Z') })])

    const actions = await service.secretActionsForGarden(USER, GARDEN, TODAY)

    expect(actions).toEqual([
      expect.objectContaining({
        ruleId: 'r20-secret-ready',
        kind: 'dated',
        dueDate: '2026-11-03',
        secret: expect.objectContaining({ stage: 'ready', trialCareLogId: 'log_1' }),
      }),
    ])
  })

  it('attend la fin de la préparation', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(tipRow('purin-ortie', { prepDays: 12 }))
    prismaMock.careLog.findMany.mockResolvedValue([log({ tipSlug: 'purin-ortie', occurredAt: new Date('2026-11-01T08:00:00Z') })])

    expect(await service.secretActionsForGarden(USER, GARDEN, TODAY)).toEqual([])
  })

  it('demande « Ça a marché ? » une semaine après l’usage', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(tipRow('feuilles-mortes'))
    prismaMock.careLog.findMany.mockResolvedValue([log({ occurredAt: new Date('2026-10-27T08:00:00Z') })])

    const actions = await service.secretActionsForGarden(USER, GARDEN, TODAY)

    expect(actions).toEqual([
      expect.objectContaining({
        ruleId: 'r20-secret-feedback',
        dueDate: '2026-11-03',
        secret: expect.objectContaining({ stage: 'feedback', trialCareLogId: 'log_1' }),
      }),
    ])
  })

  it('compte la semaine à partir de la préparation utilisée, pas de son lancement', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(tipRow('purin-ortie', { prepDays: 12 }))
    prismaMock.careLog.findMany.mockResolvedValue([
      log({ tipSlug: 'purin-ortie', occurredAt: new Date('2026-10-10T08:00:00Z') }),
      log({ id: 'log_2', tipSlug: 'purin-ortie', ruleId: 'r20-secret-ready', occurredAt: new Date('2026-11-01T08:00:00Z') }),
    ])

    expect(await service.secretActionsForGarden(USER, GARDEN, TODAY)).toEqual([])
  })

  it('ne redemande pas une fois le verdict donné', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(tipRow('feuilles-mortes'))
    prismaMock.careLog.findMany.mockResolvedValue([
      log({ occurredAt: new Date('2026-10-27T08:00:00Z'), tipVerdict: 'WORKED' }),
    ])

    expect(await service.secretActionsForGarden(USER, GARDEN, TODAY)).toEqual([])
  })
})

describe('gestes', () => {
  it('pose le verdict sur l’essai de l’utilisateur, et seulement le sien', async () => {
    prismaMock.careLog.findFirst.mockResolvedValue({ id: 'log_1', tipSlug: 'feuilles-mortes' })

    await service.recordSecretFeedback(USER, { careLogId: 'log_1', verdict: 'MEH' })

    expect(prismaMock.careLog.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 'log_1', plantInstance: { userId: USER } }) }),
    )
    expect(prismaMock.careLog.update).toHaveBeenCalledWith({
      where: { id: 'log_1' },
      data: { tipVerdict: 'MEH', tipVerdictAt: expect.any(Date) },
    })
    expect(analytics.trackServer).toHaveBeenCalledWith(USER, 'tip_feedback', {
      slug: 'feuilles-mortes',
      evidence: 'PROVEN',
      verdict: 'MEH',
    })
  })

  it('refuse le verdict sur un essai d’autrui', async () => {
    prismaMock.careLog.findFirst.mockResolvedValue(null)

    await expect(service.recordSecretFeedback(USER, { careLogId: 'log_x', verdict: 'WORKED' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect(prismaMock.careLog.update).not.toHaveBeenCalled()
  })

  it('ne réécrit pas un dévoilement déjà noté', async () => {
    prismaMock.userTip.findUnique.mockResolvedValue({ revealedAt: new Date() })

    await service.revealSecret(USER, 'feuilles-mortes')

    expect(prismaMock.userTip.upsert).not.toHaveBeenCalled()
  })

  it('refuse un secret inconnu', async () => {
    await expect(service.dismissSecret(USER, 'inconnu')).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})

describe('grimoire', () => {
  it('garde la recette d’un secret non découvert', async () => {
    prismaMock.gardenTip.findMany.mockResolvedValue([tipRow('feuilles-mortes'), tipRow('cendres'), tipRow('lune', { conditions: { lunarOnly: true } })])
    prismaMock.userTip.findMany.mockResolvedValue([{ slug: 'cendres', revealedAt: new Date(), dismissedAt: null }])
    prismaMock.careLog.findMany.mockResolvedValue([
      { tipSlug: 'feuilles-mortes', occurredAt: new Date('2026-10-01T10:00:00Z'), tipVerdict: 'WORKED' },
    ])

    const grimoire = await service.getGrimoire(USER)

    // Le secret lunaire est absent tant que l'option est coupée.
    expect(grimoire.total).toBe(2)
    expect(grimoire.discovered).toBe(2)
    const feuilles = grimoire.entries.find((entry) => entry.slug === 'feuilles-mortes')!
    expect(feuilles).toEqual(expect.objectContaining({ trials: 1, verdict: 'WORKED', recipe: 'Étape 1\nÉtape 2' }))
  })

  it('garde un secret découvert puis dépublié', async () => {
    prismaMock.gardenTip.findMany
      .mockResolvedValueOnce([tipRow('cendres')]) // publiés
      .mockResolvedValueOnce([tipRow('eau-riz', { status: 'DRAFT' })]) // retirés depuis
    prismaMock.userTip.findMany.mockResolvedValue([{ slug: 'eau-riz', revealedAt: new Date(), dismissedAt: null }])

    const grimoire = await service.getGrimoire(USER)

    expect(grimoire.entries.map((entry) => entry.slug).sort()).toEqual(['cendres', 'eau-riz'])
    expect(grimoire.discovered).toBe(1)
  })

  it('ne montre que le titre et l’accroche d’un secret à découvrir', async () => {
    const grimoire = await service.getGrimoire(USER)

    expect(grimoire.entries[0]).toEqual(
      expect.objectContaining({ discovered: false, recipe: null, story: null, ingredients: [], cautions: null }),
    )
  })
})
