import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// La sève : idempotence, plafonds dans le jour de l'utilisateur, et surtout
// le contrat « créditer ne lève jamais » — un gain raté ne doit pas faire
// échouer l'arrosage qui l'a rapporté.

const prismaMock = vi.hoisted(() => ({
  sapEntry: {
    count: vi.fn(),
    create: vi.fn(),
    createMany: vi.fn(),
    deleteMany: vi.fn(),
    aggregate: vi.fn(),
    findMany: vi.fn(),
  },
  sapGift: { count: vi.fn(), create: vi.fn() },
  user: { findUnique: vi.fn() },
  block: { findFirst: vi.fn() },
  // Une transaction doublée exécute simplement le corps.
  $transaction: vi.fn((fn: (tx: unknown) => unknown) => fn(prismaMock)),
}))
const userService = vi.hoisted(() => ({ getUserTimezone: vi.fn() }))
const analytics = vi.hoisted(() => ({ trackServer: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/user.service', () => userService)
vi.mock('@/lib/analytics/server', () => analytics)
vi.mock('@vercel/functions', () => ({ waitUntil: vi.fn() }))

const {
  awardSap,
  awardSapMany,
  getSapSummary,
  giveSapDrop,
  listSapHistory,
  revokeSap,
} = await import('../sap.service')
const { encodeCursor } = await import('../community/cursor')

const USER = 'user_1'
// 23 h 30 UTC le 6 novembre : il est déjà 00 h 30 le 7 à Paris. Le plafond
// se compte sur le jour de l'utilisateur, pas sur celui de l'UTC.
const LATE_EVENING_UTC = new Date('2026-11-06T23:30:00Z')

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  userService.getUserTimezone.mockResolvedValue('Europe/Paris')
  prismaMock.sapEntry.count.mockResolvedValue(0)
  prismaMock.sapEntry.create.mockResolvedValue({})
  prismaMock.sapEntry.createMany.mockResolvedValue({ count: 0 })
  prismaMock.sapEntry.deleteMany.mockResolvedValue({ count: 0 })
  prismaMock.sapEntry.aggregate.mockResolvedValue({ _sum: { amount: null } })
  prismaMock.sapEntry.findMany.mockResolvedValue([])
  prismaMock.sapGift.count.mockResolvedValue(0)
  prismaMock.sapGift.create.mockResolvedValue({ id: 'gift_1' })
  prismaMock.block.findFirst.mockResolvedValue(null)
})

describe('awardSap', () => {
  it('crédite le montant du barème, daté du jour de l’utilisateur', async () => {
    const gained = await awardSap(USER, {
      kind: 'task_on_time',
      sourceId: 'task_1',
      label: 'Rosiers paillés à temps',
      at: LATE_EVENING_UTC,
    })

    expect(gained).toBe(2)
    expect(prismaMock.sapEntry.create).toHaveBeenCalledWith({
      data: {
        userId: USER,
        kind: 'task_on_time',
        amount: 2,
        sourceId: 'task_1',
        // 00 h 30 à Paris : c'est déjà le 7, pas le 6 de l'UTC.
        day: '2026-11-07',
        label: 'Rosiers paillés à temps',
      },
    })
    expect(prismaMock.sapEntry.count).toHaveBeenCalledWith({
      where: { userId: USER, kind: 'task_on_time', day: '2026-11-07' },
    })
    expect(analytics.trackServer).toHaveBeenCalledWith(USER, 'sap_awarded', { kind: 'task_on_time', amount: 2 })
  })

  it('ne crédite plus rien une fois le plafond du jour atteint', async () => {
    prismaMock.sapEntry.count.mockResolvedValue(10)

    expect(await awardSap(USER, { kind: 'care', sourceId: 'log_11' })).toBe(0)
    expect(prismaMock.sapEntry.create).not.toHaveBeenCalled()
    expect(analytics.trackServer).not.toHaveBeenCalled()
  })

  it('ne compte pas le plafond d’un type qui n’en a pas', async () => {
    expect(await awardSap(USER, { kind: 'secret_feedback', sourceId: 'log_trial' })).toBe(5)
    expect(prismaMock.sapEntry.count).not.toHaveBeenCalled()
  })

  it('un gain déjà crédité rend 0, sans bruit', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.sapEntry.create.mockRejectedValue(uniqueViolation())

    expect(await awardSap(USER, { kind: 'post', sourceId: 'post_1' })).toBe(0)
    expect(error).not.toHaveBeenCalled()
    expect(analytics.trackServer).not.toHaveBeenCalled()
    error.mockRestore()
  })

  it('ne lève jamais, même base en panne', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    userService.getUserTimezone.mockRejectedValue(new Error('base injoignable'))

    await expect(awardSap(USER, { kind: 'care', sourceId: 'log_1' })).resolves.toBe(0)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })
})

describe('awardSapMany', () => {
  it('ne crédite que ce qui tient sous le plafond, dans l’ordre', async () => {
    prismaMock.sapEntry.count.mockResolvedValue(8) // 8 arrosages déjà notés aujourd'hui
    prismaMock.sapEntry.createMany.mockResolvedValue({ count: 2 })

    const items = ['a', 'b', 'c', 'd'].map((id) => ({ sourceId: `log_${id}` }))
    const gained = await awardSapMany(USER, 'care', items, LATE_EVENING_UTC)

    expect(gained).toBe(2)
    const { data, skipDuplicates } = prismaMock.sapEntry.createMany.mock.calls[0][0]
    expect(skipDuplicates).toBe(true)
    expect(data.map((row: { sourceId: string }) => row.sourceId)).toEqual(['log_a', 'log_b'])
    expect(data[0]).toMatchObject({ userId: USER, kind: 'care', amount: 1, day: '2026-11-07' })
  })

  it('rien à créditer : aucune requête', async () => {
    expect(await awardSapMany(USER, 'care', [])).toBe(0)
    expect(userService.getUserTimezone).not.toHaveBeenCalled()
  })

  it('plafond déjà atteint : aucune écriture', async () => {
    prismaMock.sapEntry.count.mockResolvedValue(10)
    expect(await awardSapMany(USER, 'care', [{ sourceId: 'log_x' }])).toBe(0)
    expect(prismaMock.sapEntry.createMany).not.toHaveBeenCalled()
  })

  it('rend la sève réellement écrite, pas celle demandée', async () => {
    prismaMock.sapEntry.createMany.mockResolvedValue({ count: 1 }) // l'autre existait déjà
    expect(await awardSapMany(USER, 'plant_added', [{ sourceId: 'p1' }, { sourceId: 'p2' }])).toBe(2)
  })
})

describe('revokeSap', () => {
  it('reprend les gains nommés, et eux seuls', async () => {
    await revokeSap(USER, 'care', ['log_1', 'log_2'])
    expect(prismaMock.sapEntry.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER, kind: 'care', sourceId: { in: ['log_1', 'log_2'] } },
    })
  })

  it('ne lève jamais', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.sapEntry.deleteMany.mockRejectedValue(new Error('panne'))
    await expect(revokeSap(USER, 'task_on_time', 'task_1')).resolves.toBeUndefined()
    error.mockRestore()
  })
})

describe('getSapSummary', () => {
  it('somme le journal, en tire les cernes, et compte les gouttes de la semaine', async () => {
    prismaMock.sapEntry.aggregate.mockResolvedValue({ _sum: { amount: 340 } })
    prismaMock.sapGift.count.mockResolvedValue(1)
    const recent = [{ id: 'e1', kind: 'care', amount: 1, label: null, createdAt: new Date() }]
    prismaMock.sapEntry.findMany.mockResolvedValue(recent)

    const summary = await getSapSummary(USER, new Date('2026-11-06T10:00:00Z'))

    expect(summary.total).toBe(340)
    expect(summary.rings).toMatchObject({ count: 3, next: 500, remaining: 160 })
    expect(summary.giftsLeft).toBe(2)
    expect(summary.giftsPerWeek).toBe(3)
    expect(summary.recent).toBe(recent)
    expect(prismaMock.sapGift.count).toHaveBeenCalledWith({ where: { fromUserId: USER, week: '2026-W45' } })
  })

  it('un compte sans aucun gain part de zéro', async () => {
    const summary = await getSapSummary(USER)
    expect(summary.total).toBe(0)
    expect(summary.rings.count).toBe(0)
    expect(summary.giftsLeft).toBe(3)
  })
})

describe('listSapHistory', () => {
  it('lit une ligne d’avance pour savoir s’il reste une page', async () => {
    const rows = Array.from({ length: 3 }, (_, i) => ({
      id: `e${i}`,
      createdAt: new Date(Date.UTC(2026, 10, 6 - i)),
    }))
    prismaMock.sapEntry.findMany.mockResolvedValue(rows)

    const page = await listSapHistory(USER, null, 2)

    expect(page.items).toHaveLength(2)
    expect(page.nextCursor).toBeTruthy()
    expect(prismaMock.sapEntry.findMany.mock.calls[0][0]).toMatchObject({ where: { userId: USER }, take: 3 })
  })

  it('reprend après le curseur, en départageant à l’identifiant', async () => {
    const createdAt = new Date('2026-11-05T08:00:00Z')
    await listSapHistory(USER, encodeCursor({ createdAt, id: 'e9' }))

    expect(prismaMock.sapEntry.findMany.mock.calls[0][0].where).toEqual({
      userId: USER,
      OR: [{ createdAt: { lt: createdAt } }, { createdAt, id: { lt: 'e9' } }],
    })
  })

  it('un curseur illisible ramène la première page', async () => {
    await listSapHistory(USER, 'n’importe quoi')
    expect(prismaMock.sapEntry.findMany.mock.calls[0][0].where).toEqual({ userId: USER })
  })
})

describe('giveSapDrop', () => {
  const GIVER = { id: 'u_dan', handle: 'dan', communityEnabled: true, timezone: 'Europe/Paris' }
  const RECEIVER = {
    id: 'u_camille',
    handle: 'camille',
    communityEnabled: true,
    disabledAt: null,
    timezone: 'Europe/Paris',
  }
  const NOW = new Date('2026-11-06T10:00:00Z')

  function users(giver: unknown, receiver: unknown) {
    prismaMock.user.findUnique.mockImplementation(({ where }: { where: { id?: string } }) =>
      Promise.resolve(where.id ? giver : receiver),
    )
  }

  it('écrit la goutte et le gain du receveur dans la même transaction', async () => {
    users(GIVER, RECEIVER)

    const result = await giveSapDrop(
      GIVER.id,
      { handle: 'camille', reason: 'bouture', message: ' Merci ! ', postId: 'post_1' },
      NOW,
    )

    expect(result).toEqual({ giftsLeft: 2 })
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
    expect(prismaMock.sapGift.create).toHaveBeenCalledWith({
      data: {
        fromUserId: GIVER.id,
        toUserId: RECEIVER.id,
        reason: 'bouture',
        message: 'Merci !',
        postId: 'post_1',
        week: '2026-W45',
      },
    })
    expect(prismaMock.sapEntry.create).toHaveBeenCalledWith({
      data: {
        userId: RECEIVER.id,
        kind: 'gift_received',
        amount: 1,
        sourceId: 'gift_1',
        day: '2026-11-06',
        label: '@dan t’a offert une goutte pour ta bouture',
      },
    })
    expect(analytics.trackServer).toHaveBeenCalledWith(GIVER.id, 'sap_gift_sent', { reason: 'bouture' })
  })

  it('exige un profil public pour remercier', async () => {
    users({ ...GIVER, communityEnabled: false }, RECEIVER)
    await expect(giveSapDrop(GIVER.id, { handle: 'camille', reason: 'aide' }, NOW)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    })
  })

  it.each([
    ['inconnu', null],
    ['profil désactivé', { ...RECEIVER, communityEnabled: false }],
    ['compte fermé', { ...RECEIVER, disabledAt: new Date() }],
  ])('répond 404 pour un receveur %s', async (_, receiver) => {
    users(GIVER, receiver)
    await expect(giveSapDrop(GIVER.id, { handle: 'camille', reason: 'aide' }, NOW)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
    expect(prismaMock.sapGift.create).not.toHaveBeenCalled()
  })

  it('répond la même 404 quand un blocage sépare les deux comptes', async () => {
    users(GIVER, RECEIVER)
    prismaMock.block.findFirst.mockResolvedValue({ blockerId: RECEIVER.id })
    await expect(giveSapDrop(GIVER.id, { handle: 'camille', reason: 'aide' }, NOW)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })
  })

  it('refuse de s’offrir une goutte', async () => {
    users(GIVER, { ...RECEIVER, id: GIVER.id, handle: 'dan' })
    await expect(giveSapDrop(GIVER.id, { handle: 'dan', reason: 'aide' }, NOW)).rejects.toMatchObject({
      code: 'INVALID_INPUT',
    })
  })

  it('passe le petit mot à la liste noire', async () => {
    users(GIVER, RECEIVER)
    await expect(
      giveSapDrop(GIVER.id, { handle: 'camille', reason: 'aide', message: 'espèce de connard' }, NOW),
    ).rejects.toMatchObject({ code: 'INVALID_INPUT' })
    expect(prismaMock.sapGift.create).not.toHaveBeenCalled()
  })

  it('trois gouttes par semaine, pas une de plus', async () => {
    users(GIVER, RECEIVER)
    prismaMock.sapGift.count.mockResolvedValue(3)
    await expect(giveSapDrop(GIVER.id, { handle: 'camille', reason: 'aide' }, NOW)).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
    })
  })
})
