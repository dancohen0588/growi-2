import { beforeEach, describe, expect, it, vi } from 'vitest'

// Le SQL de cette section échappe aux tests unitaires — il a été essayé
// contre Postgres. Ce qui est vérifié ici : les calculs faits en mémoire
// (cernes, avant/après) et l'assemblage, Prisma doublé.

vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))
const prismaMock = vi.hoisted(() => ({
  sapEntry: { findFirst: vi.fn(), groupBy: vi.fn(), count: vi.fn() },
  quartierWeek: { findMany: vi.fn() },
  quartierResult: { findMany: vi.fn() },
  user: { groupBy: vi.fn() },
  $queryRaw: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { gesturesPerActive, ringDistribution, sapStats, splitAroundLaunch, getAdminSapStats } = await import(
  '../admin-sap-stats.service'
)

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.sapEntry.findFirst.mockResolvedValue(null)
  prismaMock.sapEntry.groupBy.mockResolvedValue([])
  prismaMock.sapEntry.count.mockResolvedValue(0)
  prismaMock.quartierWeek.findMany.mockResolvedValue([])
  prismaMock.quartierResult.findMany.mockResolvedValue([])
  prismaMock.user.groupBy.mockResolvedValue([])
  prismaMock.$queryRaw.mockResolvedValue([])
})

describe('calculs en mémoire', () => {
  it('répartit les comptes par cernes, trous compris', () => {
    // 10 → 0 cerne, 60 → 1, 320 → 3.
    expect(ringDistribution([10, 60, 320, 40])).toEqual([
      { rings: 0, accounts: 2 },
      { rings: 1, accounts: 1 },
      { rings: 2, accounts: 0 },
      { rings: 3, accounts: 1 },
    ])
    expect(ringDistribution([])).toEqual([{ rings: 0, accounts: 0 }])
  })

  it('gestes par actif, sans diviser par zéro', () => {
    expect(gesturesPerActive([{ week: 'a', gestures: 30, active: 4 }, { week: 'b', gestures: 12, active: 4 }])).toBe(5.3)
    expect(gesturesPerActive([{ week: 'a', gestures: 3, active: 0 }])).toBeNull()
  })

  it('n’attribue la semaine du lancement ni à l’avant ni à l’après', () => {
    const points = ['2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'].map((week) => ({
      week,
      gestures: 1,
      active: 1,
    }))
    // Lancement le jeudi 5 novembre : la semaine du 2 est mixte.
    const { before, after } = splitAroundLaunch(points, new Date('2026-11-05T10:00:00Z'))
    expect(before.map((p) => p.week)).toEqual(['2026-10-19', '2026-10-26'])
    expect(after.map((p) => p.week)).toEqual(['2026-11-09', '2026-11-16'])
  })
})

describe('assemblage', () => {
  it('avant tout gain : rien de lancé, pas de comparaison possible', async () => {
    const stats = await sapStats(new Date('2026-11-06T10:00:00Z'))
    expect(stats.launchedAt).toBeNull()
    expect(stats.gesturesPerActive.after).toBeNull()
    expect(stats.j30).toEqual({ before: { cohort: 0, retained: 0 }, after: { cohort: 0, retained: 0 } })
    expect(stats.gesturesByWeek).toHaveLength(12)
    expect(stats.themes[0]).toEqual({ theme: 'classique', accounts: 0 })
  })

  it('les participants et réussites des défis clos, du plus ancien au plus récent', async () => {
    prismaMock.quartierWeek.findMany.mockResolvedValue([
      { week: '2026-W45', slug: 'paillage' },
      { week: '2026-W44', slug: 'photos' },
    ])
    prismaMock.quartierResult.findMany.mockResolvedValue([
      { week: '2026-W45', contributed: 3, reached: true },
      { week: '2026-W45', contributed: 0, reached: true },
      { week: '2026-W44', contributed: 1, reached: false },
    ])

    const { quartier } = await sapStats(new Date('2026-11-10T10:00:00Z'))

    expect(quartier).toEqual([
      { week: '2026-W44', slug: 'photos', participants: 1, reached: 0 },
      { week: '2026-W45', slug: 'paillage', participants: 1, reached: 2 },
    ])
  })

  it('une panne rend « indisponible » au lieu d’emporter la page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    prismaMock.sapEntry.findFirst.mockRejectedValue(new Error('relation "sap_entries" does not exist'))
    expect(await getAdminSapStats()).toBeNull()
  })
})
