import { beforeEach, describe, expect, it, vi } from 'vitest'

// La tournée de « Tout arrosé » écrite en requêtes groupées : ce qui est noté,
// ce qui est écarté, et ce qui avance sur la plante.

const taskService = vi.hoisted(() => ({ completeTasksForGesture: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: {} }))
vi.mock('@/lib/analytics/server', () => ({ trackServer: vi.fn() }))
vi.mock('@/lib/recommendation/garden-advice-service', () => ({ invalidateGardenAdviceCache: vi.fn() }))
vi.mock('@/lib/services/plant.service', () => ({ assertPlantOwned: vi.fn() }))
vi.mock('@/lib/services/task.service', () => taskService)

const { logCareBatch } = await import('../log.service')

const USER = 'user_1'
const NOW = new Date('2026-11-03T15:35:20.000Z')
const DAY_START = new Date('2026-11-02T23:00:00.000Z')

const tx = {
  plantInstance: { findMany: vi.fn(), updateMany: vi.fn() },
  careLog: { findMany: vi.fn(), createManyAndReturn: vi.fn() },
}

beforeEach(() => {
  vi.clearAllMocks()
  tx.plantInstance.findMany.mockResolvedValue([{ id: 'p1' }, { id: 'p2' }, { id: 'p3' }])
  tx.careLog.findMany.mockResolvedValue([])
  tx.careLog.createManyAndReturn.mockImplementation(({ data }: { data: Array<{ plantInstanceId: string; type: string }> }) =>
    data.map((row, i) => ({ id: `log_${i + 1}`, plantInstanceId: row.plantInstanceId, type: row.type })),
  )
})

const water = (id: string) => ({ plantInstanceId: id, type: 'watering' as const })

describe('logCareBatch', () => {
  it('écrit la tournée en une fois et avance la date d’arrosage des plantes', async () => {
    const result = await logCareBatch(USER, [water('p1'), water('p2')], tx as never, NOW)

    expect(result.logs.map((log) => log.plantInstanceId)).toEqual(['p1', 'p2'])
    expect(tx.careLog.createManyAndReturn).toHaveBeenCalledTimes(1)
    expect(tx.plantInstance.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p1', 'p2'] }, userId: USER },
      data: { lastWateredAt: NOW },
    })
    expect(taskService.completeTasksForGesture).toHaveBeenCalledWith(USER, ['p1', 'p2'], 'watering', NOW, tx)
  })

  it('écarte les plantes qui ne sont plus à l’utilisateur sans bloquer les autres', async () => {
    tx.plantInstance.findMany.mockResolvedValue([{ id: 'p2' }])

    const result = await logCareBatch(USER, [water('p1'), water('p2')], tx as never, NOW)

    expect(result.unknownPlantIds).toEqual(['p1'])
    expect(result.logs.map((log) => log.plantInstanceId)).toEqual(['p2'])
  })

  it('ne réécrit pas un geste déjà noté depuis le début de la journée', async () => {
    tx.careLog.findMany.mockResolvedValue([{ plantInstanceId: 'p1', type: 'watering' }])

    const result = await logCareBatch(USER, [water('p1'), water('p2')], tx as never, NOW, 'planning', {
      skipIfLoggedSince: DAY_START,
    })

    expect(tx.careLog.findMany).toHaveBeenCalledWith({
      where: {
        plantInstanceId: { in: ['p1', 'p2'] },
        type: { in: ['watering'] },
        occurredAt: { gte: DAY_START },
      },
      select: { plantInstanceId: true, type: true },
    })
    expect(result.alreadyLogged).toEqual([water('p1')])
    expect(result.logs.map((log) => log.plantInstanceId)).toEqual(['p2'])
    // La date de p1 ne bouge pas : elle porte déjà l'arrosage de ce matin.
    expect(tx.plantInstance.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['p2'] }, userId: USER },
      data: { lastWateredAt: NOW },
    })
  })

  it('n’écrit rien quand toute la tournée est déjà faite', async () => {
    tx.careLog.findMany.mockResolvedValue([
      { plantInstanceId: 'p1', type: 'watering' },
      { plantInstanceId: 'p2', type: 'watering' },
    ])

    const result = await logCareBatch(USER, [water('p1'), water('p2')], tx as never, NOW, 'planning', {
      skipIfLoggedSince: DAY_START,
    })

    expect(result.logs).toEqual([])
    expect(tx.careLog.createManyAndReturn).not.toHaveBeenCalled()
    expect(tx.plantInstance.updateMany).not.toHaveBeenCalled()
  })

  it('n’écrit qu’une fois une plante présente deux fois dans la tournée', async () => {
    const result = await logCareBatch(USER, [water('p1'), water('p1')], tx as never, NOW)

    expect(result.logs).toHaveLength(1)
  })
})
