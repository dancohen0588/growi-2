'use server'

import { revalidatePath } from 'next/cache'

import { auth } from '@/auth'
import type { GardenAdviceResult, PlantAdvice } from '@/lib/recommendation/types'
import * as adviceService from '@/lib/services/advice.service'

export async function getGardenAdviceAction(
  gardenId: string,
): Promise<GardenAdviceResult> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  return adviceService.getGardenAdvice(gardenId, session.user.id)
}

export async function getPlantAdviceAction(
  plantInstanceId: string,
): Promise<PlantAdvice> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  return adviceService.getPlantAdvice(plantInstanceId, session.user.id)
}

export async function markActionDoneAction(
  actionId: string,
  gardenId: string,
  actionType?: string,
  plantId?: string,
  /** Renseigné pour une tâche planifiée, absent pour une action du moteur. */
  taskId?: string,
): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await adviceService.markActionDone(session.user.id, { gardenId, actionType, plantId, taskId })

  revalidatePath('/dashboard/plantes')
  revalidatePath('/dashboard/calendrier')
}
