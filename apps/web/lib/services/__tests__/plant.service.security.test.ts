import { beforeEach, describe, expect, it, vi } from 'vitest'

// Verrouille les contrôles d'appartenance : un `gardenId` ou un `zoneId` reçu
// du client ne doit jamais être appliqué sans vérification.

const prismaMock = vi.hoisted(() => ({
  plantInstance: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  garden: { findFirst: vi.fn() },
  gardenZone: { findFirst: vi.fn() },
  plantCatalog: { findUnique: vi.fn() },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/recommendation/garden-advice-service', () => ({
  invalidateGardenAdviceCache: vi.fn(),
}))

const plantService = await import('../plant.service')

const USER = 'user_1'

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.plantInstance.create.mockResolvedValue({ id: 'plant_1' })
  prismaMock.plantInstance.findUniqueOrThrow.mockResolvedValue({ id: 'plant_1' })
  prismaMock.plantInstance.update.mockResolvedValue({ id: 'plant_1' })
  prismaMock.plantCatalog.findUnique.mockResolvedValue(null)
})

describe('création : jardin ciblé', () => {
  it("refuse d'ajouter une plante dans le jardin d'un autre", async () => {
    // findFirst avec le filtre userId ne trouve rien → le jardin n'est pas à lui
    prismaMock.garden.findFirst.mockResolvedValue(null)

    await expect(
      plantService.createPlantInstance(USER, {
        location: 'OUTDOOR',
        gardenId: 'garden_de_quelquun_dautre',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    expect(prismaMock.plantInstance.create).not.toHaveBeenCalled()
  })

  it('vérifie l\'appartenance en filtrant sur userId', async () => {
    prismaMock.garden.findFirst.mockResolvedValue({ id: 'garden_1' })

    await plantService.createPlantInstance(USER, {
      location: 'OUTDOOR',
      gardenId: 'garden_1',
    })

    expect(prismaMock.garden.findFirst).toHaveBeenCalledWith({
      where: { id: 'garden_1', userId: USER },
      select: { id: true },
    })
    expect(prismaMock.plantInstance.create).toHaveBeenCalled()
  })

  it('retombe sur le jardin le plus récent quand aucun n\'est fourni', async () => {
    prismaMock.garden.findFirst.mockResolvedValue({ id: 'garden_recent' })

    await plantService.createPlantInstance(USER, { location: 'OUTDOOR' })

    expect(prismaMock.garden.findFirst).toHaveBeenCalledWith({
      where: { userId: USER },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    })
  })
})

describe('mise à jour : jardin et zone ciblés', () => {
  beforeEach(() => {
    prismaMock.plantInstance.findFirst.mockResolvedValue({ gardenId: 'garden_1' })
  })

  it("refuse de déplacer sa plante dans le jardin d'un autre", async () => {
    prismaMock.garden.findFirst.mockResolvedValue(null)

    await expect(
      plantService.updatePlantInstance('plant_1', USER, { gardenId: 'garden_autre' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    expect(prismaMock.plantInstance.update).not.toHaveBeenCalled()
  })

  it("refuse de rattacher sa plante à la zone d'un autre", async () => {
    // La réponse expose le nom et la couleur de la zone : l'accepter
    // reviendrait à les divulguer.
    prismaMock.gardenZone.findFirst.mockResolvedValue(null)

    await expect(
      plantService.updatePlantInstance('plant_1', USER, { zoneId: 'zone_autre' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })

    expect(prismaMock.plantInstance.update).not.toHaveBeenCalled()
  })

  it('vérifie la zone en remontant jusqu\'au propriétaire du jardin', async () => {
    prismaMock.gardenZone.findFirst.mockResolvedValue({ id: 'zone_1' })

    await plantService.updatePlantInstance('plant_1', USER, { zoneId: 'zone_1' })

    expect(prismaMock.gardenZone.findFirst).toHaveBeenCalledWith({
      where: { id: 'zone_1', garden: { userId: USER } },
      select: { id: true },
    })
    expect(prismaMock.plantInstance.update).toHaveBeenCalled()
  })

  it('laisse passer une mise à jour sans jardin ni zone', async () => {
    await plantService.updatePlantInstance('plant_1', USER, { customName: 'Basilic' })

    expect(prismaMock.garden.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.gardenZone.findFirst).not.toHaveBeenCalled()
    expect(prismaMock.plantInstance.update).toHaveBeenCalled()
  })

  it("refuse de modifier la plante d'un autre", async () => {
    prismaMock.plantInstance.findFirst.mockResolvedValue(null)

    await expect(
      plantService.updatePlantInstance('plant_autre', USER, { customName: 'X' }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' })
  })
})
