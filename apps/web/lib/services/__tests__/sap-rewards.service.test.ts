import { Prisma } from '@prisma/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Les récompenses des cernes : remises une fois et une seule par cerne, jamais
// reprises, et une panne ne casse jamais la lecture de la sève. Prisma est
// doublé, comme partout : rien ici n'atteint une base.

const prismaMock = vi.hoisted(() => ({
  sapReward: { findMany: vi.fn(), create: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
  user: { findUnique: vi.fn(), update: vi.fn() },
}))
const sapService = vi.hoisted(() => ({ getSapSummary: vi.fn() }))
const secretsService = vi.hoisted(() => ({ revealRewardSecret: vi.fn(), secretTitles: vi.fn() }))
const trackServer = vi.hoisted(() => vi.fn())

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/sap.service', () => sapService)
vi.mock('@/lib/services/secrets.service', () => secretsService)
vi.mock('@/lib/analytics/server', () => ({ trackServer }))

const { ensureRingRewards, getSapOverview, setHomeTheme, getHomeTheme } = await import('../sap-rewards.service')

const USER = 'user_1'
const AT = new Date('2026-11-06T09:00:00Z')

function uniqueViolation() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.sapReward.findMany.mockResolvedValue([])
  prismaMock.sapReward.create.mockImplementation(({ data }: { data: { ring: number } }) =>
    Promise.resolve({ id: `reward_${data.ring}`, ...data }),
  )
  secretsService.revealRewardSecret.mockResolvedValue('purin-ortie')
  secretsService.secretTitles.mockResolvedValue(new Map([['purin-ortie', 'Le purin d’ortie']]))
})

describe('ensureRingRewards', () => {
  it('ne fait rien avant le premier cerne', async () => {
    await ensureRingRewards(USER, 0)
    expect(prismaMock.sapReward.findMany).not.toHaveBeenCalled()
  })

  it('remet chaque cerne manquant : un secret au 1ᵉʳ, le thème « Sous-bois » au 2ᵉ', async () => {
    await ensureRingRewards(USER, 2)

    expect(prismaMock.sapReward.create).toHaveBeenNthCalledWith(1, {
      data: { userId: USER, ring: 1, kind: 'secret', value: null },
    })
    expect(secretsService.revealRewardSecret).toHaveBeenCalledWith(USER, `${USER}:cerne:1`)
    expect(prismaMock.sapReward.update).toHaveBeenCalledWith({
      where: { id: 'reward_1' },
      data: { value: 'purin-ortie' },
    })
    expect(prismaMock.sapReward.create).toHaveBeenNthCalledWith(2, {
      data: { userId: USER, ring: 2, kind: 'theme', value: 'sous-bois' },
    })
    expect(secretsService.revealRewardSecret).toHaveBeenCalledTimes(1)
    expect(trackServer).toHaveBeenCalledWith(USER, 'sap_reward_unlocked', { ring: 2, kind: 'theme' })
  })

  it('ne remet pas deux fois un cerne déjà remis', async () => {
    prismaMock.sapReward.findMany.mockResolvedValue([{ ring: 1 }, { ring: 2 }])
    await ensureRingRewards(USER, 3)

    expect(prismaMock.sapReward.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.sapReward.create.mock.calls[0][0].data.ring).toBe(3)
  })

  it('une lecture concurrente qui a gagné la ligne : pas de second secret', async () => {
    prismaMock.sapReward.create.mockRejectedValueOnce(uniqueViolation())
    await ensureRingRewards(USER, 1)

    expect(secretsService.revealRewardSecret).not.toHaveBeenCalled()
    expect(trackServer).not.toHaveBeenCalled()
  })

  it('plus aucun secret à découvrir : le cerne est remis, sans valeur', async () => {
    secretsService.revealRewardSecret.mockResolvedValue(null)
    await ensureRingRewards(USER, 1)

    expect(prismaMock.sapReward.create).toHaveBeenCalledTimes(1)
    expect(prismaMock.sapReward.update).not.toHaveBeenCalled()
  })

  it('ne lève jamais', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.sapReward.findMany.mockRejectedValue(new Error('base injoignable'))
    await expect(ensureRingRewards(USER, 2)).resolves.toBeUndefined()
  })
})

describe('getSapOverview', () => {
  it('remet les cernes du résumé puis les nomme', async () => {
    sapService.getSapSummary.mockResolvedValue({
      total: 160,
      rings: { count: 2, floor: 150, next: 300, progress: 0.07, remaining: 140 },
      giftsLeft: 3,
      giftsPerWeek: 3,
      recent: [],
    })
    prismaMock.sapReward.findMany
      .mockResolvedValueOnce([]) // ensureRingRewards
      .mockResolvedValueOnce([
        { id: 'r1', ring: 1, kind: 'secret', value: 'purin-ortie', createdAt: AT },
        { id: 'r2', ring: 2, kind: 'theme', value: 'sous-bois', createdAt: AT },
      ])
    prismaMock.user.findUnique.mockResolvedValue({ homeTheme: 'sous-bois' })

    const overview = await getSapOverview(USER)

    expect(prismaMock.sapReward.create).toHaveBeenCalledTimes(2)
    expect(overview.rewards).toEqual([
      { ring: 1, kind: 'secret', value: 'purin-ortie', title: 'Le purin d’ortie', createdAt: AT },
      { ring: 2, kind: 'theme', value: 'sous-bois', title: 'Sous-bois', createdAt: AT },
    ])
    expect(overview.homeTheme).toBe('sous-bois')
  })
})

describe('getSapOverview sans la table des récompenses', () => {
  it('rend la sève sans récompenses plutôt que d’échouer', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    sapService.getSapSummary.mockResolvedValue({
      total: 60,
      rings: { count: 1, floor: 50, next: 150, progress: 0.1, remaining: 90 },
      giftsLeft: 3,
      giftsPerWeek: 3,
      recent: [],
    })
    prismaMock.sapReward.findMany.mockRejectedValue(new Error('relation "sap_rewards" does not exist'))
    prismaMock.user.findUnique.mockRejectedValue(new Error('column "homeTheme" does not exist'))

    const overview = await getSapOverview(USER)

    expect(overview.total).toBe(60)
    expect(overview.rewards).toEqual([])
    expect(overview.homeTheme).toBeNull()
  })
})

describe('thème d’Accueil', () => {
  it('refuse un thème pas encore débloqué, sans rien écrire', async () => {
    prismaMock.sapReward.findFirst.mockResolvedValue(null)
    await expect(setHomeTheme(USER, 'prairie')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(prismaMock.user.update).not.toHaveBeenCalled()
  })

  it('pose un thème débloqué', async () => {
    prismaMock.sapReward.findFirst.mockResolvedValue({ id: 'r2' })
    await expect(setHomeTheme(USER, 'sous-bois')).resolves.toBe('sous-bois')
    expect(prismaMock.sapReward.findFirst).toHaveBeenCalledWith({
      where: { userId: USER, kind: 'theme', value: 'sous-bois' },
      select: { id: true },
    })
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: USER }, data: { homeTheme: 'sous-bois' } })
    expect(trackServer).toHaveBeenCalledWith(USER, 'home_theme_changed', { theme: 'sous-bois' })
  })

  it('revenir au classique ne demande rien', async () => {
    await setHomeTheme(USER, null)
    expect(prismaMock.sapReward.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.user.update).toHaveBeenCalledWith({ where: { id: USER }, data: { homeTheme: null } })
  })

  it('une valeur inconnue en base vaut le classique', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ homeTheme: 'jungle' })
    expect(await getHomeTheme(USER)).toBeNull()
  })
})
