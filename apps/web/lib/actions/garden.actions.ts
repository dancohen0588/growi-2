'use server'

import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { createGardenSchema, type CreateGardenInput } from '@growi/shared'

import * as gardenService from '@/lib/services/garden.service'

/** Ce dont le sélecteur de jardin a besoin — rien de plus. */
export interface GardenSummary {
  id: string
  name: string
  type: string
  plantCount: number
}

/** L'éditeur de plan ne charge que le nom et le canevas du jardin ouvert. */
export interface GardenEditorData {
  id: string
  name: string
  canvasData: string | null
}

export async function getUserGardens() {
  const session = await auth()
  if (!session?.user?.id) return []

  return gardenService.listGardens(session.user.id)
}

/**
 * Les jardins de l'utilisateur, du plus récent au plus ancien — le même ordre
 * que la liste de l'app mobile.
 */
export async function getGardenSummaries(): Promise<GardenSummary[]> {
  const session = await auth()
  if (!session?.user?.id) return []

  const gardens = await gardenService.listGardens(session.user.id)

  return gardens.map(g => ({
    id: g.id,
    name: g.name,
    type: g.type,
    plantCount: g._count.plantInstances,
  }))
}

/**
 * Charge le jardin à éditer. Sans identifiant, on ouvre le jardin courant
 * (le plus récent), créé au besoin.
 */
export async function loadGardenForEditor(
  gardenId?: string | null,
): Promise<GardenEditorData | null> {
  const session = await auth()
  if (!session?.user?.id) return null

  const garden = await gardenService.getOrCreateCurrentGarden(session.user.id, gardenId)

  return { id: garden.id, name: garden.name, canvasData: garden.canvasData }
}

/**
 * Renomme un jardin.
 *
 * Le nom vit dans la colonne `name`, jamais dans `canvasData` : c'est celui
 * que servent l'API v1 et l'app mobile. Le garder dans le seul plan dessiné
 * ferait diverger les deux surfaces dès le premier renommage.
 */
export async function renameGarden(gardenId: string, name: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  const trimmed = name.trim()
  if (!trimmed) throw new Error('Nom requis')

  await gardenService.updateGarden(gardenId, session.user.id, { name: trimmed.slice(0, 50) })

  revalidatePath('/dashboard/jardin')
  return { success: true }
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

/**
 * Supprime le jardin **et ses plantes** (voir `garden.service`). Les écrans qui
 * listent les plantes ou le planning doivent donc être revalidés eux aussi.
 */
export async function deleteGarden(gardenId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await gardenService.deleteGarden(gardenId, session.user.id)

  revalidatePath('/dashboard/jardin')
  revalidatePath('/dashboard/plantes', 'layout')
  revalidatePath('/dashboard/calendrier')
  return { success: true }
}
