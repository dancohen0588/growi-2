'use server'

import { revalidatePath } from 'next/cache'

import {
  clearPlanningTodaySchema,
  markActionsDoneBulkSchema,
  undoActionSchema,
  type ClearPlanningTodayInput,
  type MarkActionsDoneBulkInput,
  type MarkActionsDoneBulkResult,
  type UndoActionInput,
} from '@growi/shared'

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
): Promise<{ careLogId: string | null }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  const result = await adviceService.markActionDone(session.user.id, {
    gardenId,
    actionType,
    plantId,
    taskId,
  })

  revalidatePlanning()
  return result
}

/** « Tout arrosé » et « Tout marquer comme fait » : un aller-retour, pas N. */
export async function markActionsDoneAction(
  input: MarkActionsDoneBulkInput,
): Promise<MarkActionsDoneBulkResult> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  const parsed = markActionsDoneBulkSchema.parse(input)
  const result = await adviceService.markActionsDone(session.user.id, parsed)

  revalidatePlanning()
  return result
}

/** « Ignorer pour aujourd'hui », et le « Rétablir » du bandeau qui suit. */
export async function clearPlanningTodayAction(
  input: ClearPlanningTodayInput,
): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await adviceService.clearPlanningToday(session.user.id, clearPlanningTodaySchema.parse(input))
  revalidatePlanning()
}

/** Annule un geste noté par erreur — et le défait vraiment, journal compris. */
export async function undoActionAction(input: UndoActionInput): Promise<void> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await adviceService.undoAction(session.user.id, undoActionSchema.parse(input))
  revalidatePlanning()
}

/** Les deux écrans qui montrent des actions du planning. */
function revalidatePlanning(): void {
  revalidatePath('/dashboard/plantes')
  revalidatePath('/dashboard/calendrier')
}
