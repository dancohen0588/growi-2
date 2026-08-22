'use server'

import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import {
  addIdentifiedPlantSchema,
  createPlantInstanceSchema,
  type AddIdentifiedPlantInput,
  type CreatePlantInstanceInput,
  type HealthStatus,
} from '@growi/shared'

import type { Plant } from '@/lib/plant-types'
import { toPlant } from '@/lib/plant-mapper'
import * as logService from '@/lib/services/log.service'
import * as plantService from '@/lib/services/plant.service'

// ── Server Actions ─────────────────────────────────────────────────────────

export async function getUserPlants(gardenId?: string): Promise<Plant[]> {
  const session = await auth()
  if (!session?.user?.id) return []

  const instances = await plantService.listPlantInstances(session.user.id, gardenId)
  return instances.map(toPlant)
}

export async function addPlantToMyGarden(
  data: CreatePlantInstanceInput,
): Promise<{ success: boolean; plant?: Plant; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Non authentifié' }

  const validated = createPlantInstanceSchema.parse(data)
  const instance = await plantService.createPlantInstance(session.user.id, validated)

  revalidatePath('/dashboard/plantes', 'layout')
  return { success: true, plant: toPlant(instance) }
}

export async function addIdentifiedPlantToMyPlants(
  input: AddIdentifiedPlantInput,
): Promise<{ success: boolean; plantId?: string; error?: string }> {
  const session = await auth()
  if (!session?.user?.id) return { success: false, error: 'Non authentifié' }

  const validated = addIdentifiedPlantSchema.parse(input)
  const plant = await plantService.addIdentifiedPlant(session.user.id, validated)

  revalidatePath('/dashboard/plantes', 'layout')
  return { success: true, plantId: plant.id }
}

export async function logWatering(
  plantInstanceId: string,
  note?: string,
): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await logService.logWatering(plantInstanceId, session.user.id, note)

  revalidatePath('/dashboard/plantes')
  return { success: true }
}

export async function updatePlantHealth(
  plantInstanceId: string,
  status: HealthStatus,
  note?: string,
): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await logService.logHealth(plantInstanceId, session.user.id, status, { note })

  revalidatePath('/dashboard/plantes')
  return { success: true }
}

export async function deletePlantInstance(
  plantInstanceId: string,
): Promise<{ success: boolean }> {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await plantService.deletePlantInstance(plantInstanceId, session.user.id)

  revalidatePath('/dashboard/plantes')
  revalidatePath('/dashboard/calendrier')
  return { success: true }
}
