import { beforeEach, describe, expect, it, vi } from 'vitest'

// Supprimer un jardin emporte ses plantes — même règle sur le web et dans
// l'app, qui passent tous deux par ce service. Les photos, elles, ne partent
// avec aucune cascade SQL : les oublier laisserait des fichiers orphelins.

const prismaMock = vi.hoisted(() => ({
  garden: { findFirst: vi.fn(), delete: vi.fn() },
  plantInstance: { findMany: vi.fn(), deleteMany: vi.fn() },
  careLog: { findMany: vi.fn() },
  diagnosis: { findMany: vi.fn() },
  $transaction: vi.fn(),
}))
const storageMock = vi.hoisted(() => ({ deletePhotoByUrl: vi.fn() }))
const adviceMock = vi.hoisted(() => ({ invalidateGardenAdviceCache: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/storage', () => storageMock)
vi.mock('@/lib/recommendation/garden-advice-service', () => adviceMock)

const gardenService = await import('../garden.service')

const USER = 'user_1'
const GARDEN = 'garden_1'

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.garden.findFirst.mockResolvedValue({ id: GARDEN })
  prismaMock.plantInstance.findMany.mockResolvedValue([])
  prismaMock.careLog.findMany.mockResolvedValue([])
  prismaMock.diagnosis.findMany.mockResolvedValue([])
  prismaMock.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops))
})

describe('suppression d’un jardin', () => {
  it('supprime ses plantes dans la même transaction que lui', async () => {
    await gardenService.deleteGarden(GARDEN, USER)

    expect(prismaMock.plantInstance.deleteMany).toHaveBeenCalledWith({
      where: { gardenId: GARDEN, userId: USER },
    })
    expect(prismaMock.garden.delete).toHaveBeenCalledWith({
      where: { id: GARDEN, userId: USER },
    })
    expect(prismaMock.$transaction).toHaveBeenCalledOnce()
  })

  it('efface les photos des plantes, de leurs gestes et de leurs diagnostics', async () => {
    prismaMock.plantInstance.findMany.mockResolvedValue([
      { photoUrl: 'https://sb/plante.jpg' },
      { photoUrl: null },
    ])
    prismaMock.careLog.findMany.mockResolvedValue([{ photoUrl: 'https://sb/geste.jpg' }])
    prismaMock.diagnosis.findMany.mockResolvedValue([{ photoUrl: 'https://sb/diagnostic.jpg' }])

    await gardenService.deleteGarden(GARDEN, USER)

    expect(storageMock.deletePhotoByUrl).toHaveBeenCalledWith('https://sb/plante.jpg')
    expect(storageMock.deletePhotoByUrl).toHaveBeenCalledWith('https://sb/geste.jpg')
    expect(storageMock.deletePhotoByUrl).toHaveBeenCalledWith('https://sb/diagnostic.jpg')
  })

  it('vide le cache de conseils, qui n’a pas de clé étrangère vers le jardin', async () => {
    await gardenService.deleteGarden(GARDEN, USER)

    expect(adviceMock.invalidateGardenAdviceCache).toHaveBeenCalledWith(GARDEN)
  })

  it('refuse le jardin d’un autre sans rien supprimer', async () => {
    prismaMock.garden.findFirst.mockResolvedValue(null)

    await expect(gardenService.deleteGarden(GARDEN, USER)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    })

    expect(prismaMock.$transaction).not.toHaveBeenCalled()
    expect(prismaMock.plantInstance.deleteMany).not.toHaveBeenCalled()
    expect(storageMock.deletePhotoByUrl).not.toHaveBeenCalled()
  })
})
