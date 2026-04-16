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
): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  const garden = await prisma.garden.findFirst({
    where: { id: gardenId, userId: session.user.id },
    select: { id: true },
  })
  if (!garden) throw new Error('Jardin introuvable')

  await invalidateGardenAdviceCache(gardenId)
}
