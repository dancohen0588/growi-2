import { beforeEach, describe, expect, it, vi } from 'vitest'

// Prisma est doublé, et `auditWrite` exécute l'écriture sur la doublure en
// gardant l'entrée de journal qu'elle aurait écrite — même montage que
// `blog-admin.service.test.ts`.

const prismaMock = vi.hoisted(() => ({
  gardenTip: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    groupBy: vi.fn(),
  },
  gardenTipPick: { groupBy: vi.fn(), count: vi.fn() },
  userTip: { groupBy: vi.fn(), count: vi.fn() },
  careLog: { groupBy: vi.fn(), count: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const journal = vi.hoisted(() => [] as Array<Record<string, unknown>>)
vi.mock('@/lib/admin/audit', () => ({
  auditWrite: async (write: (tx: unknown) => Promise<unknown>, entry: unknown) => {
    const result = await write(prismaMock)
    journal.push((typeof entry === 'function' ? entry(result) : entry) as Record<string, unknown>)
    return result
  },
}))

const secrets = vi.hoisted(() => ({ forgetPublishedTips: vi.fn() }))
vi.mock('@/lib/services/secrets.service', () => secrets)

const service = await import('../secrets-admin.service')
const { SECRET_LIBRARY } = await import('@/lib/secrets/library')

function tip(overrides: Record<string, unknown> = {}) {
  return {
    id: 'tip_1',
    slug: 'eau-banane',
    title: 'L’eau dorée des rosiers',
    teaser: 'Une peau de banane, un bocal d’eau, et tes rosiers te diront merci.',
    story: null,
    recipe: 'Coupe deux peaux de banane en morceaux.\nLaisse-les tremper deux jours dans un litre d’eau.\nArrose le pied avec le liquide filtré.',
    ingredients: ['peaux de banane', 'eau'],
    evidence: 'FOLK',
    cautions: null,
    prepDays: 2,
    effortMinutes: 10,
    cooldownDays: 120,
    conditions: { genera: ['Rosa'], months: [4, 5, 6] },
    status: 'DRAFT',
    createdAt: new Date('2026-11-05T08:00:00Z'),
    updatedAt: new Date('2026-11-05T08:00:00Z'),
    ...overrides,
  }
}

/** Ce qu'envoie le formulaire : `readGardenTipForm` produit cette forme. */
const form = (overrides: Record<string, unknown> = {}) => ({
  title: 'L’eau dorée des rosiers',
  teaser: 'Une peau de banane, un bocal d’eau, et tes rosiers te diront merci.',
  story: '',
  recipe: 'Coupe deux peaux de banane en morceaux.\r\n\r\n  Laisse-les tremper deux jours dans un litre d’eau.  \r\nArrose le pied avec le liquide filtré.',
  ingredients: ['peaux de banane', 'eau'],
  evidence: 'FOLK',
  cautions: '',
  prepDays: 2,
  effortMinutes: 10,
  cooldownDays: 120,
  conditions: { genera: ['Rosa'], months: [6, 4, 5, 5], categories: [], weather: {} },
  ...overrides,
})

beforeEach(() => {
  vi.clearAllMocks()
  journal.length = 0
  prismaMock.gardenTip.findUnique.mockResolvedValue(tip())
  prismaMock.gardenTip.create.mockImplementation(async ({ data }) => ({ ...tip(), ...data, id: 'tip_new' }))
  prismaMock.gardenTip.update.mockImplementation(async ({ data }) => ({ ...tip(), ...data }))
  prismaMock.gardenTip.delete.mockResolvedValue(tip())
  for (const model of [prismaMock.gardenTipPick, prismaMock.userTip, prismaMock.careLog]) {
    model.count.mockResolvedValue(0)
    model.groupBy.mockResolvedValue([])
  }
})

describe('création', () => {
  it('crée en brouillon, normalise recette et conditions, et journalise', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(null)

    const created = await service.createGardenTip('admin_1', { ...form(), slug: ' eau-banane ', status: 'PUBLISHED' })

    const { data } = prismaMock.gardenTip.create.mock.calls[0][0]
    expect(data).toMatchObject({ slug: 'eau-banane', status: 'DRAFT', story: null, cautions: null })
    expect(data.recipe).toBe(
      'Coupe deux peaux de banane en morceaux.\nLaisse-les tremper deux jours dans un litre d’eau.\nArrose le pied avec le liquide filtré.',
    )
    // Listes vides et météo vide retirées, mois dédoublonnés et triés.
    expect(data.conditions).toEqual({ genera: ['Rosa'], months: [4, 5, 6] })
    expect(journal[0]).toMatchObject({
      action: 'secret.create',
      targetType: 'garden_tip',
      targetId: created.id,
      details: { slug: 'eau-banane' },
    })
    expect(secrets.forgetPublishedTips).toHaveBeenCalled()
  })

  it('refuse un slug déjà pris, ou mal formé', async () => {
    await expect(service.createGardenTip('admin_1', { ...form(), slug: 'eau-banane' })).rejects.toMatchObject({
      code: 'CONFLICT',
    })

    prismaMock.gardenTip.findUnique.mockResolvedValue(null)
    await expect(service.createGardenTip('admin_1', { ...form(), slug: 'Eau Banane' })).rejects.toThrow(
      /Identifiant : minuscules/,
    )
    expect(prismaMock.gardenTip.create).not.toHaveBeenCalled()
  })

  it('rend des messages en français, avec la mesure', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(null)
    await expect(
      service.createGardenTip('admin_1', { ...form({ teaser: 'x'.repeat(161) }), slug: 'nouveau' }),
    ).rejects.toThrow('Accroche : 160 caractères au plus.')
    await expect(
      service.createGardenTip('admin_1', { ...form({ cooldownDays: undefined }), slug: 'nouveau' }),
    ).rejects.toThrow('Délai avant de reproposer : valeur manquante ou invalide.')
  })

  it('refuse le mot « IA » partout où le jardinier le lirait', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(null)
    await expect(
      service.createGardenTip('admin_1', { ...form({ cautions: 'Validé par une IA.' }), slug: 'nouveau' }),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT', message: expect.stringMatching(/IA/) })
  })
})

describe('édition', () => {
  it('ne touche jamais au slug ni au statut, et ne journalise que les noms des champs changés', async () => {
    await service.updateGardenTip('admin_1', 'tip_1', {
      ...form({ teaser: 'Ne jette plus tes peaux de banane : tes rosiers en raffolent.' }),
      slug: 'autre-slug',
      status: 'PUBLISHED',
    })

    const { data } = prismaMock.gardenTip.update.mock.calls[0][0]
    expect(data).not.toHaveProperty('slug')
    expect(data).not.toHaveProperty('status')
    // Recette identique une fois normalisée, conditions identiques une fois
    // remises en forme canonique : seule l'accroche a changé.
    expect(journal[0]).toEqual({
      actorId: 'admin_1',
      action: 'secret.update',
      targetType: 'garden_tip',
      targetId: 'tip_1',
      details: { slug: 'eau-banane', champs: ['teaser'] },
    })
    expect(secrets.forgetPublishedTips).toHaveBeenCalled()
  })

  it('efface un champ facultatif vidé', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(tip({ story: 'Une vieille histoire.', effortMinutes: 10 }))
    await service.updateGardenTip('admin_1', 'tip_1', form({ story: '', effortMinutes: undefined }))

    expect(prismaMock.gardenTip.update.mock.calls[0][0].data).toMatchObject({ story: null, effortMinutes: null })
    expect(journal[0]).toMatchObject({ details: { champs: ['story', 'effortMinutes'] } })
  })

  it('n’écrit rien quand la saisie est invalide', async () => {
    await expect(service.updateGardenTip('admin_1', 'tip_1', form({ recipe: '\n\n  court \n' }))).rejects.toThrow(
      'Recette : 20 caractères au moins.',
    )
    expect(prismaMock.gardenTip.update).not.toHaveBeenCalled()
    expect(journal).toHaveLength(0)
  })
})

describe('planche', () => {
  const planche = {
    panels: [
      {
        art: 'eau-cuisson/1',
        caption: 'Garde l’eau de cuisson des légumes, sans sel ni matière grasse.',
        emphasis: 'sans sel ni matière grasse',
      },
      { art: 'eau-cuisson/2', caption: 'Laisse-la refroidir complètement.' },
    ],
    caution: {
      art: 'eau-cuisson/caution',
      title: 'Jamais salée ni grasse.',
      text: 'Le sel brûle les racines, surtout en pot.',
    },
  }

  it('écrit la planche en forme canonique, et la journalise sous « planche »', async () => {
    await service.updateGardenTip('admin_1', 'tip_1', form({ planche: { ...planche, panels: [{ ...planche.panels[0] }, { ...planche.panels[1], emphasis: undefined }] } }))

    const { data } = prismaMock.gardenTip.update.mock.calls[0][0]
    expect(data.planche).toEqual(planche)
    expect(data.planche.panels[1]).not.toHaveProperty('emphasis')
    expect(journal[0]).toMatchObject({ details: { champs: ['planche'] } })
  })

  it('« Pas de planche » écrit DbNull — pas le JSON null', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(tip({ planche }))
    await service.updateGardenTip('admin_1', 'tip_1', form({ planche: null }))

    const { Prisma } = await import('@prisma/client')
    expect(prismaMock.gardenTip.update.mock.calls[0][0].data.planche).toBe(Prisma.DbNull)
    expect(journal[0]).toMatchObject({ details: { champs: ['planche'] } })
  })

  it('ne touche pas à la colonne quand la saisie n’en parle pas', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(tip({ planche }))
    await service.updateGardenTip('admin_1', 'tip_1', form())

    expect(prismaMock.gardenTip.update.mock.calls[0][0].data).not.toHaveProperty('planche')
    expect(journal[0]).toMatchObject({ details: { champs: [] } })
  })

  it('une planche relue de la base, clés réordonnées par Postgres, n’est pas notée comme modifiée', async () => {
    const reordered = {
      caution: { text: planche.caution.text, title: planche.caution.title, art: planche.caution.art },
      panels: planche.panels.map(({ caption, art, emphasis }) => ({ emphasis, caption, art })),
    }
    prismaMock.gardenTip.findUnique.mockResolvedValue(tip({ planche: reordered }))
    await service.updateGardenTip('admin_1', 'tip_1', form({ planche }))

    expect(journal[0]).toMatchObject({ details: { champs: [] } })
  })

  it('refuse un dessin inconnu ou un gras introuvable, avec le chemin en français', async () => {
    await expect(
      service.updateGardenTip(
        'admin_1',
        'tip_1',
        form({ planche: { panels: [planche.panels[0], { art: 'eau-cuisson/9', caption: 'Une case.' }] } }),
      ),
    ).rejects.toThrow(/Planche › case 2 › dessin : Dessin inconnu/)

    await expect(
      service.updateGardenTip(
        'admin_1',
        'tip_1',
        form({ planche: { panels: [{ art: 'eau-cuisson/1', caption: 'Garde l’eau.', emphasis: 'sel' }] } }),
      ),
    ).rejects.toThrow(/Planche › case 1 › passage en gras : Le passage en gras/)

    await expect(service.updateGardenTip('admin_1', 'tip_1', form({ planche: { panels: [] } }))).rejects.toThrow(
      /Planche › case : 1 élément\(s\) au moins/,
    )
    expect(prismaMock.gardenTip.update).not.toHaveBeenCalled()
  })

  it('refuse le mot « IA » dans une légende ou une précaution', async () => {
    await expect(
      service.updateGardenTip(
        'admin_1',
        'tip_1',
        form({ planche: { panels: [{ art: 'eau-cuisson/1', caption: 'Conseil validé par une IA.' }] } }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT', message: expect.stringMatching(/IA/) })

    await expect(
      service.updateGardenTip(
        'admin_1',
        'tip_1',
        form({ planche: { panels: [planche.panels[1]], caution: { ...planche.caution, text: 'Une IA le dit.' } } }),
      ),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
  })

  it('crée un secret avec sa planche', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(null)
    await service.createGardenTip('admin_1', { ...form({ planche }), slug: 'eau-cuisson' })
    expect(prismaMock.gardenTip.create.mock.calls[0][0].data.planche).toEqual(planche)
  })

  it('refuse de publier une planche devenue illisible', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(
      tip({ planche: { panels: [{ art: 'retire/1', caption: 'Un dessin disparu.' }] } }),
    )
    await expect(service.publishGardenTip('admin_1', 'tip_1')).rejects.toThrow(/Publication impossible — Planche › case 1 › dessin/)
  })
})

describe('cycle de vie', () => {
  it('publie la version enregistrée, et vide le cache du planning', async () => {
    await service.publishGardenTip('admin_1', 'tip_1')

    expect(prismaMock.gardenTip.update.mock.calls[0][0].data).toEqual({ status: 'PUBLISHED' })
    expect(journal[0]).toMatchObject({ action: 'secret.publish', details: { slug: 'eau-banane' } })
    expect(secrets.forgetPublishedTips).toHaveBeenCalled()
  })

  it('refuse de publier des conditions illisibles, que le planning écarterait en silence', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(tip({ conditions: { months: [13] } }))
    await expect(service.publishGardenTip('admin_1', 'tip_1')).rejects.toThrow(/Publication impossible — Conditions › months/)
    expect(prismaMock.gardenTip.update).not.toHaveBeenCalled()
  })

  it('ne republie pas un secret publié, et ne dépublie que ce qui l’est', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValueOnce(tip({ status: 'PUBLISHED' }))
    await expect(service.publishGardenTip('admin_1', 'tip_1')).rejects.toMatchObject({ code: 'CONFLICT' })
    await expect(service.unpublishGardenTip('admin_1', 'tip_1')).rejects.toMatchObject({ code: 'CONFLICT' })
  })

  it('dépublie en brouillon', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(tip({ status: 'PUBLISHED' }))
    await service.unpublishGardenTip('admin_1', 'tip_1')
    expect(prismaMock.gardenTip.update.mock.calls[0][0].data).toEqual({ status: 'DRAFT' })
    expect(journal[0]).toMatchObject({ action: 'secret.unpublish' })
  })
})

describe('suppression', () => {
  it('refuse un secret publié', async () => {
    prismaMock.gardenTip.findUnique.mockResolvedValue(tip({ status: 'PUBLISHED' }))
    await expect(service.deleteGardenTip('admin_1', 'tip_1')).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(prismaMock.gardenTip.delete).not.toHaveBeenCalled()
  })

  it.each([
    ['tiré', prismaMock.gardenTipPick],
    ['essayé', prismaMock.careLog],
    ['dévoilé ou refusé', prismaMock.userTip],
  ])('refuse un brouillon déjà %s : son slug vit dans le journal des jardiniers', async (_, model) => {
    model.count.mockResolvedValue(1)
    await expect(service.deleteGardenTip('admin_1', 'tip_1')).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(prismaMock.gardenTip.delete).not.toHaveBeenCalled()
  })

  it('supprime un brouillon jamais tiré, et le journal garde le titre', async () => {
    await service.deleteGardenTip('admin_1', 'tip_1')
    expect(prismaMock.gardenTip.delete).toHaveBeenCalledWith({ where: { id: 'tip_1' } })
    expect(journal[0]).toMatchObject({ action: 'secret.delete', details: { slug: 'eau-banane', titre: tip().title } })
  })
})

describe('statistiques', () => {
  it('compte tirages, dévoilements, refus, essais et verdicts — en comptes, pas en ratios', async () => {
    prismaMock.gardenTipPick.groupBy.mockResolvedValue([{ slug: 'eau-banane', _count: { _all: 10 } }])
    prismaMock.userTip.groupBy.mockImplementation(async ({ where }) =>
      where.revealedAt
        ? [{ slug: 'eau-banane', _count: { _all: 6 } }]
        : [{ slug: 'eau-banane', _count: { _all: 2 } }],
    )
    prismaMock.careLog.groupBy.mockResolvedValue([
      { tipSlug: 'eau-banane', tipVerdict: null, _count: { _all: 1 } },
      { tipSlug: 'eau-banane', tipVerdict: 'WORKED', _count: { _all: 2 } },
      { tipSlug: 'eau-banane', tipVerdict: 'FAILED', _count: { _all: 1 } },
      { tipSlug: 'eau-banane', tipVerdict: 'PEUT-ETRE', _count: { _all: 1 } },
    ])

    const stats = await service.statsForSlugs(['eau-banane', 'purin-ortie'])

    expect(stats.get('eau-banane')).toEqual({
      picked: 10,
      revealed: 6,
      dismissed: 2,
      tried: 5,
      answered: 3,
      verdicts: { WORKED: 2, MEH: 0, FAILED: 1 },
    })
    expect(stats.get('purin-ortie')).toEqual(service.emptyStats())
    // Les essais sont ceux de la règle du secret de la semaine, pas ses suites.
    expect(prismaMock.careLog.groupBy.mock.calls[0][0].where).toMatchObject({ ruleId: 'r20-secret' })
  })

  it('n’interroge pas la base pour une liste vide', async () => {
    expect((await service.statsForSlugs([])).size).toBe(0)
    expect(prismaMock.gardenTipPick.groupBy).not.toHaveBeenCalled()
  })

  it('attache les statistiques aux lignes de la liste', async () => {
    prismaMock.gardenTip.findMany.mockResolvedValue([{ id: 'tip_1', slug: 'eau-banane', title: 't' }])
    prismaMock.gardenTipPick.groupBy.mockResolvedValue([{ slug: 'eau-banane', _count: { _all: 3 } }])

    const [row] = await service.listTipsByStatus('PUBLISHED')
    expect(prismaMock.gardenTip.findMany.mock.calls[0][0].where).toEqual({ status: 'PUBLISHED' })
    expect(row.stats.picked).toBe(3)
  })
})

describe('bibliothèque de départ', () => {
  it('chacun des secrets livrés se republierait sans retouche', () => {
    for (const seed of SECRET_LIBRARY) {
      const parsed = service.gardenTipEditSchema.safeParse({
        prepDays: 0,
        cooldownDays: 120,
        ...seed,
      })
      expect(parsed.success ? null : `${seed.slug} : ${service.describeTipIssues(parsed.error)}`).toBeNull()
    }
  })
})
