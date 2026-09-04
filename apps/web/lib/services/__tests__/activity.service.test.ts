import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Doublures ─────────────────────────────────────────────────────────────

const prismaMock = vi.hoisted(() => ({
  userActivity: { upsert: vi.fn() },
  user: { update: vi.fn() },
  $transaction: vi.fn(async (ops: unknown[]) => ops),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const {
  TOUCH_INTERVAL_MS,
  activityDay,
  recordActivity,
  resetActivityThrottle,
  touchActivity,
} = await import('../activity.service')

beforeEach(() => {
  vi.clearAllMocks()
  resetActivityThrottle()
  prismaMock.$transaction.mockImplementation(async (ops: unknown[]) => ops)
})

/** Laisse les promesses lancées sans `await` par `touchActivity` se dérouler. */
const flush = () => new Promise((resolve) => setImmediate(resolve))

describe('activityDay', () => {
  it('donne le jour UTC au format YYYY-MM-DD', () => {
    expect(activityDay(new Date('2026-09-04T22:30:00.000Z'))).toBe('2026-09-04')
  })

  it("bascule sur le jour UTC, pas sur celui du fuseau local", () => {
    // 23h30 à Paris en été = 21h30 UTC le même jour ; mais 01h du matin à
    // Paris est déjà 23h UTC la veille — c'est la valeur UTC qui compte,
    // comme pour IdentifyQuota.
    expect(activityDay(new Date('2026-09-04T23:30:00.000Z'))).toBe('2026-09-04')
    expect(activityDay(new Date('2026-09-05T00:10:00.000Z'))).toBe('2026-09-05')
  })
})

describe('touchActivity — étranglement', () => {
  it('écrit à la première visite', async () => {
    expect(touchActivity('user_1', 'web', 1_000)).toBe(true)
    await flush()
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it("n'écrit pas une seconde fois dans l'heure", async () => {
    touchActivity('user_1', 'web', 1_000)
    await flush()

    expect(touchActivity('user_1', 'web', 1_000 + TOUCH_INTERVAL_MS - 1)).toBe(false)
    expect(touchActivity('user_1', 'mobile', 1_000 + 60_000)).toBe(false)
    await flush()

    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })

  it("réécrit une fois l'heure passée", async () => {
    touchActivity('user_1', 'web', 1_000)
    expect(touchActivity('user_1', 'web', 1_000 + TOUCH_INTERVAL_MS)).toBe(true)
    await flush()
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2)
  })

  it('étrangle par utilisateur, pas globalement', async () => {
    expect(touchActivity('user_1', 'web', 1_000)).toBe(true)
    expect(touchActivity('user_2', 'web', 1_000)).toBe(true)
    await flush()
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(2)
  })

  it('ne lève pas et ne rejette pas quand la base est indisponible', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.$transaction.mockRejectedValue(new Error('base injoignable'))

    expect(() => touchActivity('user_1', 'web', 1_000)).not.toThrow()
    await flush()

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('recordActivity', () => {
  it('insère la ligne du jour et met à jour lastSeenAt en une transaction', async () => {
    const at = new Date('2026-09-04T10:00:00.000Z')
    await recordActivity('user_1', 'mobile', at)

    expect(prismaMock.userActivity.upsert).toHaveBeenCalledWith({
      where: { userId_day_surface: { userId: 'user_1', day: '2026-09-04', surface: 'mobile' } },
      create: { userId: 'user_1', day: '2026-09-04', surface: 'mobile' },
      // Une ligne déjà présente ne doit rien changer : la table n'a que sa clé.
      update: {},
    })
    expect(prismaMock.user.update).toHaveBeenCalledWith({
      where: { id: 'user_1' },
      data: { lastSeenAt: at },
    })
    expect(prismaMock.$transaction).toHaveBeenCalledTimes(1)
  })
})
