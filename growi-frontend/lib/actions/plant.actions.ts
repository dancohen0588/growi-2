'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Plant } from '@/lib/plant-types'
import { toPlant } from '@/lib/plant-mapper'

// ── Validation schemas ─────────────────────────────────────────────────────

const addPlantSchema = z.object({
  catalogPlantId:   z.string().optional(),
  customName:       z.string().min(1).max(50).optional(),
  emoji:            z.string().optional(),
  gardenId:         z.string().optional(),
  location:         z.enum(['OUTDOOR', 'INDOOR', 'GREENHOUSE', 'BALCONY']),
  wateringFreqDays: z.number().int().positive().optional(),
  sunExposure:      z.enum(['FULL_SUN', 'PARTIAL', 'SHADE']).optional(),
  datePlanted:      z.string().optional(),
  notes:            z.string().max(1000).optional(),
})

// ── Server Actions ─────────────────────────────────────────────────────────

export async function getUserPlants(gardenId?: string): Promise<Plant[]> {
  const session = await auth()
  if (!session?.user?.id) return []

  const instances = await prisma.plantInstance.findMany({
    where: {
      userId: session.user.id,
      ...(gardenId ? { gardenId } : {}),
    },
    include: {
      catalogPlant: true,
      zone: true,
      wateringLogs: { orderBy: { wateredAt: 'desc' }, take: 1 },
    },
    orderBy: { dateAdded: 'desc' },
  })

  return instances.map(toPlant)
}

export async function addPlantToMyGarden(
  data: z.infer<typeof addPlantSchema>,
): Promise<{ success: boolean; plant?: Plant; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Non authentifié' }

  const validated = addPlantSchema.parse(data)

  let defaults: { wateringFreqDays?: number; sunExposure?: string; emoji?: string } = {}
  if (validated.catalogPlantId) {
    const cat = await prisma.plantCatalog.findUnique({
      where: { id: validated.catalogPlantId },
    })
    if (cat) {
      defaults = {
        wateringFreqDays: cat.wateringFreqDays,
        sunExposure:      cat.sunExposure,
        emoji:            cat.emoji ?? undefined,
      }
    }
  }

  const created = await prisma.plantInstance.create({
    data: {
      ...defaults,
      ...validated,
      userId:      session.user.id,
      datePlanted: validated.datePlanted ? new Date(validated.datePlanted) : undefined,
    },
  })

  const instance = await prisma.plantInstance.findUniqueOrThrow({
    where: { id: created.id },
    include: { catalogPlant: true, zone: true },
  })

  revalidatePath('/dashboard/plantes')
  return { success: true, plant: toPlant(instance) }
}

export async function logWatering(
  plantInstanceId: string,
  note?: string,
): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await prisma.$transaction([
    prisma.wateringLog.create({ data: { plantInstanceId, note } }),
    prisma.plantInstance.update({
      where: { id: plantInstanceId, userId: session.user.id },
      data:  { lastWateredAt: new Date() },
    }),
  ])

  revalidatePath('/dashboard/plantes')
  return { success: true }
}

export async function updatePlantHealth(
  plantInstanceId: string,
  status: 'HEALTHY' | 'WARNING' | 'CRITICAL',
  note?: string,
): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await prisma.$transaction([
    prisma.healthLog.create({ data: { plantInstanceId, status, note } }),
    prisma.plantInstance.update({
      where: { id: plantInstanceId, userId: session.user.id },
      data:  { healthStatus: status, healthNote: note },
    }),
  ])

  revalidatePath('/dashboard/plantes')
  return { success: true }
}

export async function deletePlantInstance(
  plantInstanceId: string,
): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await prisma.plantInstance.delete({
    where: { id: plantInstanceId, userId: session.user.id },
  })

  revalidatePath('/dashboard/plantes')
  return { success: true }
}
