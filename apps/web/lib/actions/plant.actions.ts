'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import {
  addIdentifiedPlantSchema,
  createPlantInstanceSchema,
  type AddIdentifiedPlantInput,
  type CreatePlantInstanceInput,
  type HealthStatus as HealthStatusValue,
} from '@growi/shared'
import type { Plant } from '@/lib/plant-types'
import { toPlant } from '@/lib/plant-mapper'
import { invalidateGardenAdviceCache } from '@/lib/recommendation/garden-advice-service'

// ── Validation schemas ─────────────────────────────────────────────────────

const addPlantSchema = createPlantInstanceSchema

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
  data: CreatePlantInstanceInput,
): Promise<{ success: boolean; plant?: Plant; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Non authentifié' }

  const validated = addPlantSchema.parse(data)

  // Resolve gardenId: use provided value, or fall back to user's most recent garden
  let gardenId = validated.gardenId
  if (!gardenId) {
    const defaultGarden = await prisma.garden.findFirst({
      where: { userId: session.user.id },
      select: { id: true },
      orderBy: { createdAt: 'desc' },
    })
    gardenId = defaultGarden?.id
  }

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
      gardenId,
      userId:      session.user.id,
      datePlanted: validated.datePlanted ? new Date(validated.datePlanted) : undefined,
    },
  })

  const instance = await prisma.plantInstance.findUniqueOrThrow({
    where: { id: created.id },
    include: { catalogPlant: true, zone: true },
  })

  revalidatePath('/dashboard/plantes', 'layout')
  return { success: true, plant: toPlant(instance) }
}

// Add a plant identified by the AI vision flow to the user's plants.
// If the identified plant matches a PlantCatalog entry (via slug), link via
// catalogPlantId and inherit its defaults. Otherwise, create a custom plant
// instance using the AI-supplied commonName/emoji so nothing is lost.
// Schéma dans @growi/shared (addIdentifiedPlantSchema), partagé avec le mobile.

export async function addIdentifiedPlantToMyPlants(
  input: AddIdentifiedPlantInput,
): Promise<{ success: boolean; plantId?: string; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Non authentifié' }

  const validated = addIdentifiedPlantSchema.parse(input)

  const catalogPlant = validated.encyclopediaSlug
    ? await prisma.plantCatalog.findUnique({
        where: { slug: validated.encyclopediaSlug },
      })
    : null

  const defaultGarden = await prisma.garden.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  })

  const location =
    catalogPlant && catalogPlant.indoor && !catalogPlant.outdoor
      ? 'INDOOR'
      : 'OUTDOOR'

  const created = await prisma.plantInstance.create({
    data: {
      userId:           session.user.id,
      gardenId:         defaultGarden?.id,
      catalogPlantId:   catalogPlant?.id,
      customName:       catalogPlant ? null : validated.commonName,
      emoji:            catalogPlant?.emoji ?? validated.emoji ?? null,
      wateringFreqDays: catalogPlant?.wateringFreqDays,
      sunExposure:      catalogPlant?.sunExposure,
      location,
    },
  })

  revalidatePath('/dashboard/plantes', 'layout')
  return { success: true, plantId: created.id }
}

export async function logWatering(
  plantInstanceId: string,
  note?: string,
): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  const instance = await prisma.plantInstance.findFirst({
    where: { id: plantInstanceId, userId: session.user.id },
    select: { gardenId: true },
  })

  await prisma.$transaction([
    prisma.wateringLog.create({ data: { plantInstanceId, note } }),
    prisma.plantInstance.update({
      where: { id: plantInstanceId, userId: session.user.id },
      data:  { lastWateredAt: new Date() },
    }),
  ])

  if (instance?.gardenId) {
    await invalidateGardenAdviceCache(instance.gardenId)
  }

  revalidatePath('/dashboard/plantes')
  return { success: true }
}

export async function updatePlantHealth(
  plantInstanceId: string,
  status: HealthStatusValue,
  note?: string,
): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  const instance = await prisma.plantInstance.findFirst({
    where: { id: plantInstanceId, userId: session.user.id },
    select: { gardenId: true },
  })

  await prisma.$transaction([
    prisma.healthLog.create({ data: { plantInstanceId, status, note } }),
    prisma.plantInstance.update({
      where: { id: plantInstanceId, userId: session.user.id },
      data:  { healthStatus: status, healthNote: note },
    }),
  ])

  if (instance?.gardenId) {
    await invalidateGardenAdviceCache(instance.gardenId)
  }

  revalidatePath('/dashboard/plantes')
  return { success: true }
}

export async function deletePlantInstance(
  plantInstanceId: string,
): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  const instance = await prisma.plantInstance.findFirst({
    where: { id: plantInstanceId, userId: session.user.id },
    select: { gardenId: true },
  })

  await prisma.plantInstance.delete({
    where: { id: plantInstanceId, userId: session.user.id },
  })

  if (instance?.gardenId) {
    await invalidateGardenAdviceCache(instance.gardenId)
  }

  revalidatePath('/dashboard/plantes')
  revalidatePath('/dashboard/calendrier')
  return { success: true }
}
