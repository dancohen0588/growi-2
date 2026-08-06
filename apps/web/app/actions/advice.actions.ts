'use server'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import {
  getGardenAdvice,
  getPlantAdvice,
  invalidateGardenAdviceCache,
} from '@/lib/recommendation/garden-advice-service'
import type { GardenAdviceResult } from '@/lib/recommendation/types'
import type { PlantAdvice } from '@/lib/recommendation/types'
import { revalidatePath } from 'next/cache'

export async function getGardenAdviceAction(
  gardenId: string,
): Promise<GardenAdviceResult> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  const garden = await prisma.garden.findFirst({
    where: { id: gardenId, userId: session.user.id },
    select: { id: true },
  })
  if (!garden) throw new Error('Jardin introuvable')

  return getGardenAdvice(gardenId, session.user.id)
}

export async function getPlantAdviceAction(
  plantInstanceId: string,
): Promise<PlantAdvice> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  return getPlantAdvice(plantInstanceId, session.user.id)
}

export async function markActionDoneAction(
  actionId: string,
  gardenId: string,
  actionType?: string,
  plantId?: string,
): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  const garden = await prisma.garden.findFirst({
    where: { id: gardenId, userId: session.user.id },
    select: { id: true },
  })
  if (!garden) throw new Error('Jardin introuvable')

  // Persist the effect based on action type
  if (plantId) {
    const now = new Date()

    switch (actionType) {
      case 'arrosage':
        await prisma.$transaction([
          prisma.wateringLog.create({ data: { plantInstanceId: plantId } }),
          prisma.plantInstance.update({
            where: { id: plantId },
            data: { lastWateredAt: now },
          }),
        ])
        break

      case 'taille':
        await prisma.$transaction([
          prisma.pruningLog.create({ data: { plantInstanceId: plantId } }),
          prisma.plantInstance.update({
            where: { id: plantId },
            data: { lastPrunedAt: now },
          }),
        ])
        break

      case 'fertilisation':
        await prisma.$transaction([
          prisma.fertilizingLog.create({ data: { plantInstanceId: plantId } }),
          prisma.plantInstance.update({
            where: { id: plantId },
            data: { lastFertilizedAt: now },
          }),
        ])
        break

      case 'traitement':
        await prisma.plantInstance.update({
          where: { id: plantId },
          data: { lastTreatedAt: now },
        })
        break

      case 'rempotage':
        await prisma.plantInstance.update({
          where: { id: plantId },
          data: { lastRepottedAt: now },
        })
        break
    }
  }

  await invalidateGardenAdviceCache(gardenId)
  revalidatePath('/dashboard/plantes')
  revalidatePath('/dashboard/calendrier')
}
