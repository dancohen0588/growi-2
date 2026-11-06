import { beforeEach, describe, expect, it, vi } from 'vitest'

// La sève du journal d'entretien : un geste noté crédite, un geste effacé
// reprend — et un geste écrit dans la transaction d'un appelant ne crédite
// rien lui-même, l'appelant s'en charge une fois la transaction aboutie.

const prismaMock = vi.hoisted(() => ({
  careLog: { create: vi.fn(), findFirst: vi.fn(), delete: vi.fn() },
  plantInstance: { update: vi.fn() },
  $transaction: vi.fn(),
}))
const sap = vi.hoisted(() => ({
  awardSap: vi.fn(),
  revokeSap: vi.fn(),
  careSapLabel: (type: string, name?: string | null) => (type === 'other' && name ? name : `label:${type}`),
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/analytics/server', () => ({ trackServer: vi.fn() }))
vi.mock('@/lib/recommendation/garden-advice-service', () => ({ invalidateGardenAdviceCache: vi.fn() }))
vi.mock('@/lib/services/plant.service', () => ({ assertPlantOwned: vi.fn().mockResolvedValue({ gardenId: 'g1' }) }))
vi.mock('@/lib/services/task.service', () => ({ completeTasksForGesture: vi.fn() }))
vi.mock('@/lib/services/sap.service', () => sap)

const { deleteCareLog, logCare } = await import('../log.service')

const USER = 'user_1'
const AT = new Date('2026-11-06T09:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.careLog.create.mockResolvedValue({ id: 'log_1' })
  prismaMock.plantInstance.update.mockResolvedValue({})
  prismaMock.$transaction.mockImplementation((arg: unknown) =>
    typeof arg === 'function' ? (arg as (tx: unknown) => unknown)(prismaMock) : Promise.all(arg as unknown[]),
  )
})

describe('logCare', () => {
  it('crédite le geste, daté de son instant', async () => {
    await logCare('plant_1', USER, { type: 'watering', occurredAt: AT.toISOString() })

    expect(sap.awardSap).toHaveBeenCalledWith(USER, {
      kind: 'care',
      sourceId: 'log_1',
      label: 'label:watering',
      at: AT,
    })
  })

  it('nomme un « autre geste » par le nom que lui donne le planning', async () => {
    await logCare('plant_1', USER, { type: 'other' }, undefined, 'planning', { note: 'Paillage' })
    expect(sap.awardSap.mock.calls[0][1]).toMatchObject({ label: 'Paillage' })
  })

  it('dans la transaction d’un appelant, ne crédite rien lui-même', async () => {
    await logCare('plant_1', USER, { type: 'watering' }, prismaMock as never)
    expect(sap.awardSap).not.toHaveBeenCalled()
  })
})

describe('deleteCareLog', () => {
  it('reprend la sève du geste effacé', async () => {
    prismaMock.careLog.findFirst.mockResolvedValueOnce({
      id: 'log_1',
      type: 'pruning',
      plantInstanceId: 'plant_1',
      plantInstance: { gardenId: 'g1' },
    })
    prismaMock.careLog.findFirst.mockResolvedValueOnce(null)

    await deleteCareLog('log_1', USER)

    expect(sap.revokeSap).toHaveBeenCalledWith(USER, 'care', 'log_1')
  })

  it('un geste d’autrui n’est ni effacé ni repris', async () => {
    prismaMock.careLog.findFirst.mockResolvedValue(null)
    await expect(deleteCareLog('log_x', USER)).rejects.toMatchObject({ code: 'NOT_FOUND' })
    expect(sap.revokeSap).not.toHaveBeenCalled()
  })
})
