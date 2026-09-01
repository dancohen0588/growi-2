/**
 * Service jardins — logique métier pure.
 *
 * Aucune lecture de session ici : l'identifiant utilisateur est toujours reçu
 * en paramètre. Les appelants (Server Actions, routes API) s'occupent de
 * l'authentification, du cache Next.js et de la sérialisation.
 */

import type { CreateGardenInput, UpdateGardenInput } from '@growi/shared'

import { prisma } from '@/lib/prisma'
import { invalidateGardenAdviceCache } from '@/lib/recommendation/garden-advice-service'
import { ServiceError } from '@/lib/services/errors'
import { deletePhotoByUrl } from '@/lib/storage'

/** Jardins de l'utilisateur, avec leurs zones et le nombre de plantes. */
export async function listGardens(userId: string) {
  return prisma.garden.findMany({
    where: { userId },
    include: { zones: true, _count: { select: { plantInstances: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

/** Un jardin de l'utilisateur, ou `null` s'il n'existe pas / ne lui appartient pas. */
export async function findGarden(gardenId: string, userId: string) {
  return prisma.garden.findFirst({
    where: { id: gardenId, userId },
    include: { zones: true, _count: { select: { plantInstances: true } } },
  })
}

/**
 * Vérifie que le jardin appartient bien à l'utilisateur.
 * @throws ServiceError('NOT_FOUND') sinon — on ne distingue pas « inexistant »
 * de « appartient à quelqu'un d'autre », pour ne rien révéler.
 */
export async function assertGardenOwned(gardenId: string, userId: string): Promise<void> {
  const garden = await prisma.garden.findFirst({
    where: { id: gardenId, userId },
    select: { id: true },
  })
  if (!garden) throw new ServiceError('NOT_FOUND', 'Jardin introuvable')
}

/**
 * Jardin sur lequel travaille l'éditeur de plan : celui demandé s'il
 * appartient bien à l'utilisateur, sinon le plus récent — le même que celui
 * qu'utilisent le calendrier et les plantes ajoutées sans jardin —, créé à la
 * volée s'il n'en a aucun.
 *
 * Un identifiant inconnu ne lève pas : le web mémorise le dernier jardin
 * ouvert, et un jardin supprimé depuis l'app ne doit pas bloquer l'écran.
 */
export async function getOrCreateCurrentGarden(userId: string, gardenId?: string | null) {
  if (gardenId) {
    const requested = await prisma.garden.findFirst({ where: { id: gardenId, userId } })
    if (requested) return requested
  }

  const latest = await findLatestGarden(userId)
  if (latest) return latest

  return prisma.garden.create({
    data: {
      userId,
      name: 'Mon jardin',
      type: 'OUTDOOR',
    },
  })
}

/** Jardin le plus récent, utilisé comme jardin courant par défaut. */
export async function findLatestGarden(userId: string) {
  return prisma.garden.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}

export async function createGarden(userId: string, input: CreateGardenInput) {
  return prisma.garden.create({
    data: { ...input, userId },
  })
}

export async function updateGarden(
  gardenId: string,
  userId: string,
  input: UpdateGardenInput,
) {
  await assertGardenOwned(gardenId, userId)

  return prisma.garden.update({
    where: { id: gardenId, userId },
    data: input,
  })
}

export async function updateGardenCanvas(
  gardenId: string,
  userId: string,
  canvasData: string,
) {
  await prisma.garden.update({
    where: { id: gardenId, userId },
    data: { canvasData },
  })
}

/**
 * Supprime un jardin **et les plantes qu'il contient**.
 *
 * La cascade est faite ici et non par la base : `plant_instances.gardenId` est
 * en `SET NULL` (les plantes y survivraient, détachées), et surtout les photos
 * déposées sur Supabase ne partent avec aucune cascade SQL — il faut relever
 * leurs URL avant d'effacer les lignes. Gestes, diagnostics et tâches des
 * plantes, eux, partent bien en cascade côté base.
 *
 * C'est le seul chemin de suppression : le web comme l'API v1 passent par ici.
 */
export async function deleteGarden(gardenId: string, userId: string) {
  await assertGardenOwned(gardenId, userId)

  const [plants, logs, diagnoses] = await Promise.all([
    prisma.plantInstance.findMany({
      where: { gardenId, userId },
      select: { photoUrl: true },
    }),
    prisma.careLog.findMany({
      where: { plantInstance: { gardenId, userId }, photoUrl: { not: null } },
      select: { photoUrl: true },
    }),
    prisma.diagnosis.findMany({
      where: { plantInstance: { gardenId, userId } },
      select: { photoUrl: true },
    }),
  ])

  await prisma.$transaction([
    prisma.plantInstance.deleteMany({ where: { gardenId, userId } }),
    prisma.garden.delete({ where: { id: gardenId, userId } }),
  ])

  // Le cache de conseils n'a pas de clé étrangère vers le jardin : sans cela,
  // sa ligne resterait en base après la disparition du jardin.
  await invalidateGardenAdviceCache(gardenId)

  await Promise.all(
    [...plants, ...logs, ...diagnoses].map((row) => deletePhotoByUrl(row.photoUrl)),
  )
}
