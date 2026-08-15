/**
 * Service journal d'entretien — arrosage, taille, fertilisation, santé.
 *
 * Chaque écriture est atomique : le log est créé et la date correspondante
 * mise à jour sur la plante dans la même transaction. Le cache de conseils du
 * jardin est invalidé dans la foulée, pour que le planning reflète le geste
 * qui vient d'être enregistré.
 */

import type { HealthStatus } from '@growi/shared'

import { prisma } from '@/lib/prisma'
import { invalidateGardenAdviceCache } from '@/lib/recommendation/garden-advice-service'
import { assertPlantOwned } from '@/lib/services/plant.service'

/** Historique complet d'une plante, groupé par type d'intervention. */
export async function listPlantLogs(plantInstanceId: string, userId: string) {
  await assertPlantOwned(plantInstanceId, userId)

  const [watering, pruning, fertilizing, health] = await Promise.all([
    prisma.wateringLog.findMany({
      where: { plantInstanceId },
      orderBy: { wateredAt: 'desc' },
    }),
    prisma.pruningLog.findMany({
      where: { plantInstanceId },
      orderBy: { prunedAt: 'desc' },
    }),
    prisma.fertilizingLog.findMany({
      where: { plantInstanceId },
      orderBy: { fertilizedAt: 'desc' },
    }),
    prisma.healthLog.findMany({
      where: { plantInstanceId },
      orderBy: { loggedAt: 'desc' },
    }),
  ])

  return { watering, pruning, fertilizing, health }
}

export async function logWatering(
  plantInstanceId: string,
  userId: string,
  options: { note?: string; wateredAt?: Date } = {},
) {
  const { gardenId } = await assertPlantOwned(plantInstanceId, userId)
  const at = options.wateredAt ?? new Date()

  const [log] = await prisma.$transaction([
    prisma.wateringLog.create({
      data: { plantInstanceId, note: options.note, wateredAt: at },
    }),
    prisma.plantInstance.update({
      where: { id: plantInstanceId, userId },
      data: { lastWateredAt: at },
    }),
  ])

  await invalidateAdviceFor(gardenId)
  return log
}

export async function logPruning(
  plantInstanceId: string,
  userId: string,
  options: { note?: string; pruningType?: string; prunedAt?: Date } = {},
) {
  const { gardenId } = await assertPlantOwned(plantInstanceId, userId)
  const at = options.prunedAt ?? new Date()

  const [log] = await prisma.$transaction([
    prisma.pruningLog.create({
      data: {
        plantInstanceId,
        note: options.note,
        pruningType: options.pruningType,
        prunedAt: at,
      },
    }),
    prisma.plantInstance.update({
      where: { id: plantInstanceId, userId },
      data: { lastPrunedAt: at },
    }),
  ])

  await invalidateAdviceFor(gardenId)
  return log
}

export async function logFertilizing(
  plantInstanceId: string,
  userId: string,
  options: { note?: string; productUsed?: string; fertilizedAt?: Date } = {},
) {
  const { gardenId } = await assertPlantOwned(plantInstanceId, userId)
  const at = options.fertilizedAt ?? new Date()

  const [log] = await prisma.$transaction([
    prisma.fertilizingLog.create({
      data: {
        plantInstanceId,
        note: options.note,
        productUsed: options.productUsed,
        fertilizedAt: at,
      },
    }),
    prisma.plantInstance.update({
      where: { id: plantInstanceId, userId },
      data: { lastFertilizedAt: at },
    }),
  ])

  await invalidateAdviceFor(gardenId)
  return log
}

/** Note de santé : historisée et reportée sur l'état courant de la plante. */
export async function logHealth(
  plantInstanceId: string,
  userId: string,
  status: HealthStatus,
  options: { note?: string; photoUrl?: string; loggedAt?: Date } = {},
) {
  const { gardenId } = await assertPlantOwned(plantInstanceId, userId)
  const at = options.loggedAt ?? new Date()

  const [log] = await prisma.$transaction([
    prisma.healthLog.create({
      data: {
        plantInstanceId,
        status,
        note: options.note,
        photoUrl: options.photoUrl,
        loggedAt: at,
      },
    }),
    prisma.plantInstance.update({
      where: { id: plantInstanceId, userId },
      data: { healthStatus: status, healthNote: options.note },
    }),
  ])

  await invalidateAdviceFor(gardenId)
  return log
}

/**
 * Interventions sans journal dédié : on se contente d'horodater la plante.
 */
export async function markTreated(plantInstanceId: string, userId: string, at = new Date()) {
  const { gardenId } = await assertPlantOwned(plantInstanceId, userId)
  await prisma.plantInstance.update({
    where: { id: plantInstanceId, userId },
    data: { lastTreatedAt: at },
  })
  await invalidateAdviceFor(gardenId)
}

export async function markRepotted(plantInstanceId: string, userId: string, at = new Date()) {
  const { gardenId } = await assertPlantOwned(plantInstanceId, userId)
  await prisma.plantInstance.update({
    where: { id: plantInstanceId, userId },
    data: { lastRepottedAt: at },
  })
  await invalidateAdviceFor(gardenId)
}

async function invalidateAdviceFor(gardenId: string | null) {
  if (gardenId) await invalidateGardenAdviceCache(gardenId)
}
