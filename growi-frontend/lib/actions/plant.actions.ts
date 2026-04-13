'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { Plant, PlantLocation, SunExposure, HealthStatus, WateringDifficulty } from '@/lib/plant-types'
import type { PlantInstance, PlantCatalog, GardenZone, SunExposure as PrismaSunExposure } from '@prisma/client'

// ── Types ──────────────────────────────────────────────────────────────────

type PlantInstanceWithRelations = PlantInstance & {
  catalogPlant: PlantCatalog | null
  zone: GardenZone | null
}

// ── Mapper: Prisma → Plant (presentation type) ────────────────────────────

const locationMap: Record<string, PlantLocation> = {
  OUTDOOR:    'exterieur',
  INDOOR:     'interieur',
  GREENHOUSE: 'serre',
  BALCONY:    'balcon',
}

const healthMap: Record<string, HealthStatus> = {
  HEALTHY:  'healthy',
  WARNING:  'warning',
  CRITICAL: 'critical',
}

const sunMap: Record<string, SunExposure> = {
  FULL_SUN: 'full',
  PARTIAL:  'partial',
  SHADE:    'shade',
}

const difficultyMap: Record<string, WateringDifficulty> = {
  EASY:      'easy',
  MEDIUM:    'medium',
  DEMANDING: 'demanding',
}

const categoryMap: Record<string, Plant['category']> = {
  INDOOR:       'interieur',
  VEGETABLE:    'potager',
  FLOWERS:      'fleurs',
  TREES_SHRUBS: 'arbres',
  HERBS:        'aromatiques',
  SUCCULENTS:   'interieur',
  AQUATIC:      'potager',
  CLIMBING:     'fleurs',
}

export function toPlant(instance: PlantInstanceWithRelations): Plant {
  const cat = instance.catalogPlant
  const wateringFreqDays = instance.wateringFreqDays ?? cat?.wateringFreqDays ?? 7

  return {
    id:                 instance.id,
    name:               instance.customName ?? cat?.commonName ?? 'Ma plante',
    scientificName:     cat?.scientificName,
    emoji:              instance.emoji ?? cat?.emoji ?? '🌿',
    category:           categoryMap[cat?.category ?? ''] ?? 'interieur',
    location:           locationMap[instance.location] ?? 'exterieur',
    zone:               instance.zone?.name,
    dateAdded:          instance.dateAdded.toISOString(),
    datePlanted:        instance.datePlanted?.toISOString(),
    photoUrl:           instance.photoUrl ?? undefined,
    wateringFrequencyDays: wateringFreqDays,
    lastWateredDate:    instance.lastWateredAt?.toISOString(),
    nextWateringDate:   instance.lastWateredAt
      ? new Date(instance.lastWateredAt.getTime() + wateringFreqDays * 86_400_000).toISOString()
      : undefined,
    sunExposure:        sunMap[instance.sunExposure ?? cat?.sunExposure ?? 'PARTIAL'] ?? 'partial',
    soilType:           instance.soilType ?? undefined,
    wateringDifficulty: difficultyMap[cat?.wateringDifficulty ?? 'EASY'] ?? 'easy',
    healthStatus:       healthMap[instance.healthStatus] ?? 'healthy',
    healthNote:         instance.healthNote ?? undefined,
    description:        cat?.descriptionShort ?? '',
    careTips:           { watering: '', light: '', soil: '' },
    notes:              instance.notes ?? undefined,
  }
}

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

  let defaults: { wateringFreqDays?: number; sunExposure?: PrismaSunExposure; emoji?: string } = {}
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
