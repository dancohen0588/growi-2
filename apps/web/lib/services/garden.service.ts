/**
 * Service jardins — logique métier pure.
 *
 * Aucune lecture de session ici : l'identifiant utilisateur est toujours reçu
 * en paramètre. Les appelants (Server Actions, routes API) s'occupent de
 * l'authentification, du cache Next.js et de la sérialisation.
 */

import type { CreateGardenInput, UpdateGardenInput } from '@growi/shared'

import { prisma } from '@/lib/prisma'
import { ServiceError } from '@/lib/services/errors'

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

/** Premier jardin de l'utilisateur, créé à la volée s'il n'en a aucun. */
export async function getOrCreateDefaultGarden(userId: string) {
  const existing = await prisma.garden.findFirst({
    where: { userId },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) return existing

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

export async function deleteGarden(gardenId: string, userId: string) {
  await prisma.garden.delete({
    where: { id: gardenId, userId },
  })
}
