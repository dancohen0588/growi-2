import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// La sève du quartier : semaines à l'heure de Paris, quartier élargi tant
// qu'il est trop petit, défi figé, mercis nommés pour les seuls intéressés,
// clôture rejouable. Prisma est doublé : rien ici n'atteint une base.

const prismaMock = vi.hoisted(() => ({
  user: { findMany: vi.fn() },
  quartierWeek: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  quartierResult: { create: vi.fn(), update: vi.fn() },
  careLog: { findMany: vi.fn(), count: vi.fn() },
  post: { findMany: vi.fn() },
  sapGift: { findMany: vi.fn(), count: vi.fn() },
  sapEntry: { findMany: vi.fn(), count: vi.fn() },
}))
const sap = vi.hoisted(() => ({ awardSap: vi.fn() }))
const secrets = vi.hoisted(() => ({ revealRewardSecret: vi.fn(), secretTitles: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/sap.service', () => sap)
vi.mock('@/lib/services/secrets.service', () => secrets)

const service = await import('../quartier.service')

// Jeudi 5 novembre 2026, 10 h à Paris : semaine 2026-W45 (2 → 8 novembre).
const NOW = new Date('2026-11-05T09:00:00Z')

function member(id: string, lat: number | null, lng: number | null, radius = 20) {
  return { id, handle: id, fuzzyLat: lat, fuzzyLng: lng, communityRadiusKm: radius }
}

/** Un village de jardiniers autour de Paris, à quelques kilomètres chacun. */
function village(count: number, offset = 0) {
  return Array.from({ length: count }, (_, i) => member(`u${i + offset}`, 48.85 + i * 0.01, 2.35))
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.quartierWeek.findUnique.mockResolvedValue(null)
  prismaMock.quartierWeek.create.mockResolvedValue({})
  prismaMock.careLog.findMany.mockResolvedValue([])
  prismaMock.careLog.count.mockResolvedValue(0)
  prismaMock.post.findMany.mockResolvedValue([])
  prismaMock.sapGift.findMany.mockResolvedValue([])
  prismaMock.sapGift.count.mockResolvedValue(0)
  prismaMock.sapEntry.findMany.mockResolvedValue([])
  prismaMock.sapEntry.count.mockResolvedValue(0)
  prismaMock.quartierResult.create.mockImplementation(({ data }: { data: { userId: string } }) =>
    Promise.resolve({ id: `res_${data.userId}` }),
  )
  secrets.secretTitles.mockResolvedValue(new Map())
  secrets.revealRewardSecret.mockResolvedValue('purin-ortie')
})

describe('semaine du défi', () => {
  it('du lundi minuit au lundi suivant, heure de Paris', () => {
    const week = service.challengeWeek(NOW)
    expect(week.week).toBe('2026-W45')
    expect(week.start.toISOString()).toBe('2026-11-01T23:00:00.000Z')
    expect(week.end.toISOString()).toBe('2026-11-08T23:00:00.000Z')
    expect(week.month).toBe(11)
  })

  it('dimanche 23 h 30 à Paris est encore la même semaine', () => {
    expect(service.challengeWeek(new Date('2026-11-08T22:30:00Z')).week).toBe('2026-W45')
    expect(service.challengeWeek(new Date('2026-11-08T23:30:00Z')).week).toBe('2026-W46')
  })

  it('la semaine passée', () => {
    expect(service.challengeWeek(NOW, -1).week).toBe('2026-W44')
  })
})

describe('le quartier', () => {
  it('reste dans le rayon choisi quand il y a assez de monde', () => {
    const members = village(10)
    const quartier = service.resolveQuartier(members[0], members)
    expect(quartier.radiusKm).toBe(20)
    expect(quartier.members).toHaveLength(10)
  })

  it('s’élargit de palier en palier, puis à toute la France', () => {
    const near = village(3)
    // Cinq jardiniers à Lyon, à ~390 km : il faut monter au palier de 500.
    const lyon = Array.from({ length: 5 }, (_, i) => member(`l${i}`, 45.76 + i * 0.01, 4.84))
    const members = [...near, ...lyon]
    expect(service.resolveQuartier(near[0], members).radiusKm).toBe(500)

    // Trop peu même à 500 km : toute la France.
    const sparse = [...near, member('far', 43.6, 7.0)]
    const quartier = service.resolveQuartier(near[0], sparse)
    expect(quartier.radiusKm).toBeNull()
    expect(quartier.members).toHaveLength(4)
  })

  it('un compte sans position compte avec toute la France', () => {
    const members = [member('lost', null, null), ...village(3)]
    expect(service.resolveQuartier(members[0], members).radiusKm).toBeNull()
  })
})

describe('ce que compte un défi', () => {
  it('un geste au journal : par type, par règle, ou par le nom d’un « autre geste »', async () => {
    prismaMock.careLog.findMany.mockResolvedValue([
      { plantInstance: { userId: 'u1' } },
      { plantInstance: { userId: 'u1' } },
      { plantInstance: { userId: 'u2' } },
    ])
    const from = new Date('2026-11-01T23:00:00Z')
    const to = new Date('2026-11-08T23:00:00Z')

    const counts = await service.countContributions(
      { kind: 'care', ruleIds: ['r13-mulching'], noteIncludes: ['paill'] },
      ['u1', 'u2'],
      from,
      to,
    )

    expect(counts.get('u1')).toBe(2)
    expect(counts.get('u2')).toBe(1)
    expect(prismaMock.careLog.findMany).toHaveBeenCalledWith({
      where: {
        plantInstance: { userId: { in: ['u1', 'u2'] } },
        occurredAt: { gte: from, lt: to },
        OR: [
          { ruleId: { in: ['r13-mulching'] } },
          { type: 'other', note: { contains: 'paill', mode: 'insensitive' } },
        ],
      },
      select: { plantInstance: { select: { userId: true } } },
    })
  })

  it('personne : aucune requête', async () => {
    await service.countContributions({ kind: 'post' }, [], NOW, NOW)
    expect(prismaMock.post.findMany).not.toHaveBeenCalled()
  })
})

describe('getQuartier', () => {
  it('refuse sans profil public', async () => {
    prismaMock.user.findMany.mockResolvedValue(village(9, 1))
    await expect(service.getQuartier('u0', NOW)).rejects.toMatchObject({ code: 'FORBIDDEN' })
  })

  it('fige le défi de la semaine, et le montre avec la part de chacun', async () => {
    const members = village(10)
    prismaMock.user.findMany.mockResolvedValue(members)
    prismaMock.quartierWeek.findUnique
      .mockResolvedValueOnce(null) // la semaine en cours
      .mockResolvedValueOnce({ slug: 'mercis' }) // la précédente

    const quartier = await service.getQuartier('u0', NOW)

    expect(prismaMock.quartierWeek.create).toHaveBeenCalledTimes(1)
    const frozen = prismaMock.quartierWeek.create.mock.calls[0][0].data
    expect(frozen.week).toBe('2026-W45')
    // Jamais le défi de la semaine précédente.
    expect(frozen.slug).not.toBe('mercis')
    expect(quartier.gardeners).toBe(10)
    expect(quartier.radiusKm).toBe(20)
    expect(quartier.challenge?.week).toBe('2026-W45')
    expect(quartier.challenge?.daysLeft).toBe(4)
  })

  it('compte la part de chacun et dit si l’objectif est atteint', async () => {
    const members = village(10)
    prismaMock.user.findMany.mockResolvedValue(members)
    prismaMock.quartierWeek.findUnique.mockResolvedValue({ week: '2026-W45', slug: 'photos', closedAt: null })
    prismaMock.post.findMany.mockResolvedValue([
      ...Array.from({ length: 4 }, () => ({ userId: 'u0' })),
      ...Array.from({ length: 7 }, () => ({ userId: 'u5' })),
    ])

    const { challenge } = await service.getQuartier('u0', NOW)

    // photos : 1 par jardinier, au moins 5 → 10 pour 10 jardiniers.
    expect(challenge).toMatchObject({
      slug: 'photos',
      title: 'Partageons 10 photos de nos jardins',
      target: 10,
      progress: 11,
      mine: 4,
      participants: 2,
      participantInitials: ['U', 'U'],
      reached: true,
      unitLabel: 'photos partagées',
      action: { label: 'Publier une photo', target: 'publier' },
    })
    expect(prismaMock.quartierWeek.create).not.toHaveBeenCalled()
  })

  it('sans défi lisible, le reste du quartier s’affiche', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.user.findMany.mockResolvedValue(village(10))
    prismaMock.quartierWeek.findUnique.mockRejectedValue(new Error('relation "quartier_weeks" does not exist'))
    const quartier = await service.getQuartier('u0', NOW)
    expect(quartier.challenge).toBeNull()
    expect(quartier.gardeners).toBe(10)
  })

  it('les mercis : nommés pour moi seulement, un compteur pour le quartier', async () => {
    prismaMock.user.findMany.mockResolvedValue(village(10))
    prismaMock.quartierWeek.findUnique.mockResolvedValue({ week: '2026-W45', slug: 'photos', closedAt: null })
    prismaMock.sapGift.count.mockResolvedValue(6)
    prismaMock.sapGift.findMany.mockResolvedValue([
      {
        fromUserId: 'u4',
        reason: 'bouture',
        message: 'Merci !',
        createdAt: NOW,
        from: { handle: 'camille' },
        to: { handle: 'u0' },
      },
    ])

    const { thanks } = await service.getQuartier('u0', NOW)

    expect(thanks.weekCount).toBe(6)
    expect(thanks.mine).toEqual([
      { direction: 'received', handle: 'camille', reason: 'bouture', message: 'Merci !', createdAt: NOW.toISOString() },
    ])
    const mineQuery = prismaMock.sapGift.findMany.mock.calls.find(([args]) => args.where.OR)![0]
    expect(mineQuery.where.OR).toEqual([{ fromUserId: 'u0' }, { toUserId: 'u0' }])
  })

  it('ne cite un Secret qu’à partir de trois retours', async () => {
    prismaMock.user.findMany.mockResolvedValue(village(10))
    prismaMock.quartierWeek.findUnique.mockResolvedValue({ week: '2026-W45', slug: 'photos', closedAt: null })
    prismaMock.careLog.findMany.mockResolvedValue([
      { tipSlug: 'eau-legumes', tipVerdict: 'WORKED' },
      { tipSlug: 'eau-legumes', tipVerdict: 'WORKED' },
      { tipSlug: 'eau-legumes', tipVerdict: 'MEH' },
      { tipSlug: 'coquilles', tipVerdict: 'WORKED' },
      { tipSlug: 'coquilles', tipVerdict: 'FAILED' },
    ])
    secrets.secretTitles.mockResolvedValue(new Map([['eau-legumes', 'L’eau des légumes']]))

    const { secrets: shown } = await service.getQuartier('u0', NOW)

    expect(shown).toEqual([{ slug: 'eau-legumes', title: 'L’eau des légumes', worked: 2, total: 3 }])
    expect(secrets.secretTitles).toHaveBeenCalledWith(['eau-legumes'])
  })
})

describe('clôture de la semaine', () => {
  it('rien à clore si personne n’a ouvert le défi, ou s’il est déjà clos', async () => {
    prismaMock.quartierWeek.findUnique.mockResolvedValueOnce(null)
    expect(await service.closeQuartierWeek(NOW)).toEqual({ week: null, participants: 0, reached: 0 })
    prismaMock.quartierWeek.findUnique.mockResolvedValueOnce({ week: '2026-W44', slug: 'photos', closedAt: NOW })
    expect(await service.closeQuartierWeek(NOW)).toEqual({ week: null, participants: 0, reached: 0 })
    expect(sap.awardSap).not.toHaveBeenCalled()
  })

  it('participation, réussite et Secret pour tout le quartier', async () => {
    const members = village(10)
    prismaMock.user.findMany.mockResolvedValue(members)
    prismaMock.quartierWeek.findUnique.mockResolvedValue({ week: '2026-W44', slug: 'photos', closedAt: null })
    // 11 photos pour un objectif de 10 : réussi.
    prismaMock.post.findMany.mockResolvedValue([
      ...Array.from({ length: 4 }, () => ({ userId: 'u0' })),
      ...Array.from({ length: 7 }, () => ({ userId: 'u5' })),
    ])

    const closure = await service.closeQuartierWeek(NOW)

    expect(closure).toEqual({ week: '2026-W44', participants: 2, reached: 10 })
    expect(sap.awardSap).toHaveBeenCalledWith('u0', expect.objectContaining({ kind: 'challenge_participation', sourceId: '2026-W44' }))
    expect(sap.awardSap).toHaveBeenCalledWith('u0', expect.objectContaining({ kind: 'challenge_success', sourceId: '2026-W44' }))
    // Un non-participant d'un quartier qui a réussi : le Secret, pas la sève.
    expect(sap.awardSap).not.toHaveBeenCalledWith('u1', expect.anything())
    expect(secrets.revealRewardSecret).toHaveBeenCalledWith('u1', 'quartier:2026-W44')
    expect(secrets.revealRewardSecret).toHaveBeenCalledTimes(10)
    expect(prismaMock.quartierWeek.update).toHaveBeenCalledWith({ where: { week: '2026-W44' }, data: { closedAt: NOW } })
  })

  it('défi manqué : la participation seule, et rien pour qui n’a pas participé', async () => {
    prismaMock.user.findMany.mockResolvedValue(village(10))
    prismaMock.quartierWeek.findUnique.mockResolvedValue({ week: '2026-W44', slug: 'photos', closedAt: null })
    prismaMock.post.findMany.mockResolvedValue([{ userId: 'u2' }])

    const closure = await service.closeQuartierWeek(NOW)

    expect(closure).toEqual({ week: '2026-W44', participants: 1, reached: 0 })
    expect(prismaMock.quartierResult.create).toHaveBeenCalledTimes(1)
    expect(sap.awardSap).toHaveBeenCalledTimes(1)
    expect(secrets.revealRewardSecret).not.toHaveBeenCalled()
  })

  it('rejouée après une interruption : ce qui a été distribué ne l’est pas deux fois', async () => {
    prismaMock.user.findMany.mockResolvedValue(village(10))
    prismaMock.quartierWeek.findUnique.mockResolvedValue({ week: '2026-W44', slug: 'photos', closedAt: null })
    prismaMock.post.findMany.mockResolvedValue([{ userId: 'u2' }])
    prismaMock.quartierResult.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', { code: 'P2002', clientVersion: 'test' }),
    )

    await service.closeQuartierWeek(NOW)

    expect(sap.awardSap).not.toHaveBeenCalled()
    expect(prismaMock.quartierWeek.update).toHaveBeenCalled()
  })
})
