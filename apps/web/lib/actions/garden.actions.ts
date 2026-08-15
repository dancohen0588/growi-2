'use server'

import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { createGardenSchema, type CreateGardenInput } from '@growi/shared'

import * as gardenService from '@/lib/services/garden.service'

export async function getUserGardens() {
  const session = await auth()
  if (!session?.user?.id) return []

  return gardenService.listGardens(session.user.id)
}

export async function getOrCreateDefaultGarden() {
  const session = await auth()
  if (!session?.user?.id) return null

  return gardenService.getOrCreateDefaultGarden(session.user.id)
}

export async function createGarden(data: CreateGardenInput) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  const validated = createGardenSchema.parse(data)
  const garden = await gardenService.createGarden(session.user.id, validated)

  revalidatePath('/dashboard/jardin')
  return { success: true, garden }
}

export async function updateGardenCanvas(gardenId: string, canvasData: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await gardenService.updateGardenCanvas(gardenId, session.user.id, canvasData)

  revalidatePath('/dashboard/jardin')
  return { success: true }
}

export async function deleteGarden(gardenId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await gardenService.deleteGarden(gardenId, session.user.id)

  revalidatePath('/dashboard/jardin')
  return { success: true }
}
