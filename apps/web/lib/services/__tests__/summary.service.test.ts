import { beforeEach, describe, expect, it, vi } from 'vitest'

import { pickDailyIndex } from '@growi/shared'

// ─── Doublures ─────────────────────────────────────────────────────────────

const prismaMock = vi.hoisted(() => ({
  plantInstance: { findMany: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/planning.service', () => ({ getTodayPlanning: vi.fn() }))

const { getHeroPhoto } = await import('../summary.service')

const USER_ID = 'user-1'
const DAY = '2026-11-03'

const row = (id: string, extra: Partial<Record<string, unknown>> = {}) => ({
  id,
  customName: null,
  photoUrl: `https://cdn.test/${id}.jpg`,
  catalogPlant: { commonName: `Plante ${id}` },
  garden: { name: 'Potager' },
  ...extra,
})

beforeEach(() => {
  vi.clearAllMocks()
})

describe('getHeroPhoto', () => {
  it('ne lit que les plantes du compte qui ont une photo, dans un ordre fixe', async () => {
    prismaMock.plantInstance.findMany.mockResolvedValue([])
    await getHeroPhoto(USER_ID, DAY)

    const args = prismaMock.plantInstance.findMany.mock.calls[0][0]
    expect(args.where).toEqual({ userId: USER_ID, photoUrl: { not: null } })
    expect(args.orderBy).toBeDefined()
    expect(args.take).toBeGreaterThan(0)
  })

  it('renvoie null quand aucune plante n’a de photo', async () => {
    prismaMock.plantInstance.findMany.mockResolvedValue([])
    expect(await getHeroPhoto(USER_ID, DAY)).toBeNull()
  })

  it('tire la plante désignée par le compte et le jour', async () => {
    const rows = [row('a'), row('b'), row('c'), row('d')]
    prismaMock.plantInstance.findMany.mockResolvedValue(rows)

    const expected = rows[pickDailyIndex(`${USER_ID}:${DAY}`, rows.length)]
    expect(await getHeroPhoto(USER_ID, DAY)).toEqual({
      plantId: expected.id,
      plantName: `Plante ${expected.id}`,
      gardenName: 'Potager',
      photoUrl: expected.photoUrl,
    })
  })

  it('préfère le nom donné par l’utilisateur à celui du catalogue', async () => {
    prismaMock.plantInstance.findMany.mockResolvedValue([
      row('a', { customName: '  Basilic de la véranda ', garden: null }),
    ])
    expect(await getHeroPhoto(USER_ID, DAY)).toMatchObject({
      plantName: 'Basilic de la véranda',
      gardenName: null,
    })
  })
})
