import { beforeEach, describe, expect, it, vi } from 'vitest'

// Le secret de la semaine, ses suites et le grimoire, Prisma doublé. Le
// tirage lui-même est couvert par `lib/secrets/__tests__/select.test.ts`.

const prismaMock = vi.hoisted(() => ({
  gardenTip: { findMany: vi.fn(), findUnique: vi.fn() },
  gardenTipPick: { findUnique: vi.fn(), findFirst: vi.fn(), createMany: vi.fn() },
  // `findMany` sert au tirage, `findUnique` aux secrets hors publication.
  userTip: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), upsert: vi.fn(), updateMany: vi.fn() },
  careLog: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  plantInstance: { findMany: vi.fn(), findFirst: vi.fn() },
  plantTask: { findFirst: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn() },
}))
const analytics = vi.hoisted(() => ({ trackServer: vi.fn() }))
const weather = vi.hoisted(() => ({ fetchWeatherForecast: vi.fn() }))

const sap = vi.hoisted(() => ({ awardSap: vi.fn() }))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/sap.service', () => sap)
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
  service.forgetNoPickMemo()
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
  prismaMock.plantTask.findFirst.mockResolvedValue(null)
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

  it('porte sa planche, et l’écarte quand elle cite un dessin retiré du registre', async () => {
    const planche = { panels: [{ art: 'eau-cuisson/1', caption: 'Garde l’eau de cuisson.' }] }
    prismaMock.gardenTip.findMany.mockResolvedValue([tipRow('feuilles-mortes', { planche })])
    const [action] = await service.secretActionsForGarden(USER, GARDEN, TODAY)
    expect(action?.secret?.planche).toEqual(planche)

    service.forgetPublishedTips()
    prismaMock.gardenTip.findMany.mockResolvedValue([
      tipRow('feuilles-mortes', { planche: { panels: [{ art: 'disparu/1', caption: 'Une case.' }] } }),
    ])
    const [fallback] = await service.secretActionsForGarden(USER, GARDEN, TODAY)
    expect(fallback?.secret?.planche).toBeNull()
  })

  it('disparaît aussitôt dépublié, même tiré cette semaine', async () => {
    prismaMock.gardenTip.findMany.mockResolvedValue([])
    prismaMock.gardenTip.findUnique.mockResolvedValue(tipRow('feuilles-mortes', { status: 'DRAFT' }))

    expect(await service.secretActionsForGarden(USER, GARDEN, TODAY)).toEqual([])
  })

  it('cesse de montrer un secret lunaire tiré avant que l’option soit coupée', async () => {
    prismaMock.gardenTip.findMany.mockResolvedValue([tipRow('feuilles-mortes', { conditions: { lunarOnly: true } })])

    expect(await service.secretActionsForGarden(USER, GARDEN, TODAY)).toEqual([])
  })

  it('ne refait pas un tirage vide à chaque ouverture', async () => {
    prismaMock.gardenTipPick.findUnique.mockResolvedValue(null)
    prismaMock.gardenTip.findMany.mockResolvedValue([tipRow('ete', { conditions: { months: [7] } })])

    await service.secretActionsForGarden(USER, GARDEN, TODAY)
    await service.secretActionsForGarden(USER, GARDEN, TODAY)

    expect(prismaMock.userTip.findMany).toHaveBeenCalledTimes(1)
    expect(prismaMock.gardenTipPick.createMany).not.toHaveBeenCalled()
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

  it('se ferme quand une version de l’app sans secrets coche « c’est prêt »', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(tipRow('purin-ortie', { prepDays: 12 }))
    prismaMock.careLog.findMany.mockResolvedValue([
      log({ tipSlug: 'purin-ortie', occurredAt: new Date('2026-10-20T08:00:00Z') }),
      log({ id: 'log_2', tipSlug: null, ruleId: 'r20-secret-ready', occurredAt: new Date('2026-11-02T08:00:00Z') }),
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
    // Le retour rapporte, une fois par essai : c'est l'essai qui fait la clé.
    expect(sap.awardSap).toHaveBeenCalledWith(USER, {
      kind: 'secret_feedback',
      sourceId: 'log_1',
      label: expect.stringMatching(/^Ton retour sur « .+ »$/),
    })
  })

  it('refuse le verdict sur un essai d’autrui', async () => {
    prismaMock.careLog.findFirst.mockResolvedValue(null)

    await expect(service.recordSecretFeedback(USER, { careLogId: 'log_x', verdict: 'WORKED' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect(prismaMock.careLog.update).not.toHaveBeenCalled()
    expect(sap.awardSap).not.toHaveBeenCalled()
  })

  it('répond « introuvable » au slug deviné d’un brouillon', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(tipRow('brouillon', { status: 'DRAFT' }))
    prismaMock.userTip.findUnique.mockResolvedValue(null)
    prismaMock.careLog.findFirst.mockResolvedValue(null)

    await expect(service.revealSecret(USER, 'brouillon')).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(prismaMock.userTip.upsert).not.toHaveBeenCalled()
  })

  it('retrouve le secret d’un geste coché sans slug', async () => {
    prismaMock.gardenTipPick.findUnique.mockResolvedValue({
      slug: 'feuilles-mortes',
      plantInstanceId: 'p1',
      garden: { userId: USER },
    })
    expect(
      await service.inferTipSlug(USER, { gardenId: GARDEN, plantId: 'p1', ruleId: 'r20-secret', today: TODAY }),
    ).toBe('feuilles-mortes')
    expect(
      await service.inferTipSlug(USER, { gardenId: GARDEN, plantId: 'p2', ruleId: 'r20-secret', today: TODAY }),
    ).toBeUndefined()

    prismaMock.careLog.findFirst.mockResolvedValue({ tipSlug: 'purin-ortie' })
    expect(
      await service.inferTipSlug(USER, { gardenId: GARDEN, plantId: 'p1', ruleId: 'r20-secret-ready', today: TODAY }),
    ).toBe('purin-ortie')
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

describe('« Je tente » met le secret à faire', () => {
  const NOW = new Date('2026-11-05T21:30:00Z') // 22 h 30 à Paris, toujours le 5

  beforeEach(() => {
    prismaMock.plantInstance.findFirst.mockResolvedValue({ id: 'p1' })
    prismaMock.plantTask.create.mockImplementation(async ({ data }) => ({
      id: 'task_1',
      ...data,
      doneAt: null,
      supersededAt: null,
      plantInstance: { ...ROSE, gardenId: GARDEN },
    }))
  })

  it('ajoute une tâche datée du jour, sans rien inscrire au journal', async () => {
    const action = await service.trySecret(USER, 'feuilles-mortes', { gardenId: GARDEN, plantId: 'p1' }, NOW)

    expect(prismaMock.plantTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: USER,
          plantInstanceId: 'p1',
          source: 'SECRET',
          tipSlug: 'feuilles-mortes',
          type: 'autre',
          shortLabel: 'Titre feuilles-mortes',
          label: 'Étape 1\nÉtape 2',
          dueDate: '2026-11-05',
        }),
      }),
    )
    expect(action).toEqual(
      expect.objectContaining({ id: 'task:task_1', taskId: 'task_1', ruleId: 'r20-secret', kind: 'dated' }),
    )
    expect(action.secret).toBeUndefined()
    expect(prismaMock.careLog.update).not.toHaveBeenCalled()
  })

  it('rend la tâche déjà ouverte plutôt que d’en créer une seconde', async () => {
    prismaMock.plantTask.findFirst.mockResolvedValue({
      id: 'task_0',
      source: 'SECRET',
      tipSlug: 'feuilles-mortes',
      type: 'autre',
      label: 'Étape 1',
      shortLabel: 'Titre',
      dueDate: '2026-11-04',
      priority: 'medium',
      plantInstance: { ...ROSE, gardenId: GARDEN },
    })

    const action = await service.trySecret(USER, 'feuilles-mortes', { gardenId: GARDEN, plantId: 'p1' }, NOW)

    expect(action.taskId).toBe('task_0')
    expect(prismaMock.plantTask.create).not.toHaveBeenCalled()
  })

  it('refuse une plante qui n’est pas à l’utilisateur, dans ce jardin', async () => {
    prismaMock.plantInstance.findFirst.mockResolvedValue(null)

    await expect(
      service.trySecret(USER, 'feuilles-mortes', { gardenId: GARDEN, plantId: 'p_autre' }, NOW),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(prismaMock.plantTask.create).not.toHaveBeenCalled()
  })

  it('retire la carte de la semaine une fois le secret mis à faire', async () => {
    prismaMock.plantTask.findFirst.mockResolvedValue({ id: 'task_1' })

    const actions = await service.secretActionsForGarden(USER, GARDEN, TODAY)

    expect(actions.find((action) => action.ruleId === 'r20-secret')).toBeUndefined()
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

describe('secret en avant-première (récompense d’un cerne)', () => {
  it('dévoile un secret jamais vu — ni découvert, ni essayé, ni mis de côté, ni lunaire sans l’option', async () => {
    prismaMock.gardenTip.findMany.mockResolvedValue([
      tipRow('cendres'),
      tipRow('eau-riz'),
      tipRow('feuilles-mortes'),
      tipRow('marc-cafe'),
      tipRow('lune', { conditions: { lunarOnly: true } }),
    ])
    prismaMock.userTip.findMany.mockResolvedValue([
      { slug: 'cendres', revealedAt: new Date(), dismissedAt: null },
      { slug: 'eau-riz', revealedAt: null, dismissedAt: new Date() },
    ])
    prismaMock.careLog.findMany.mockResolvedValue([{ tipSlug: 'feuilles-mortes' }])

    const slug = await service.revealRewardSecret(USER, 'graine')

    expect(slug).toBe('marc-cafe')
    expect(prismaMock.userTip.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_slug: { userId: USER, slug: 'marc-cafe' } },
        create: expect.objectContaining({ userId: USER, slug: 'marc-cafe', revealedAt: expect.any(Date) }),
      }),
    )
  })

  it('le même tirage pour la même graine', async () => {
    prismaMock.gardenTip.findMany.mockResolvedValue([tipRow('a'), tipRow('b'), tipRow('c'), tipRow('d')])
    const first = await service.revealRewardSecret(USER, 'user_1:cerne:3')
    const second = await service.revealRewardSecret(USER, 'user_1:cerne:3')
    expect(second).toBe(first)
  })

  it('rien à découvrir : null, sans rien écrire', async () => {
    prismaMock.userTip.findMany.mockResolvedValue([{ slug: 'feuilles-mortes', revealedAt: new Date(), dismissedAt: null }])
    expect(await service.revealRewardSecret(USER, 'graine')).toBeNull()
    expect(prismaMock.userTip.upsert).not.toHaveBeenCalled()
  })
})
