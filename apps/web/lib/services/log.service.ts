/**
 * Service journal d'entretien.
 *
 * Un seul type de log couvre tous les gestes. L'écriture reste atomique : le
 * log est créé et la date correspondante mise à jour sur la plante dans la
 * même transaction, puis le cache de conseils du jardin est invalidé pour que
 * le planning reflète le geste qui vient d'être noté.
 */

import type { CareLogType, CreateCareLogInput, HealthStatus } from '@growi/shared'
import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { invalidateGardenAdviceCache } from '@/lib/recommendation/garden-advice-service'
import { assertPlantOwned } from '@/lib/services/plant.service'

/**
 * Date de la plante à faire avancer selon le geste.
 *
 * C'est par ces champs que le moteur de conseils raisonne — il ne lit pas les
 * logs. Un geste sans date associée (récolte, semis, autre) n'a donc pas
 * d'incidence sur le planning, seulement sur l'historique.
 */
const PLANT_DATE_FIELD: Partial<Record<CareLogType, keyof Prisma.PlantInstanceUpdateInput>> = {
  watering: 'lastWateredAt',
  pruning: 'lastPrunedAt',
  fertilizing: 'lastFertilizedAt',
  treatment: 'lastTreatedAt',
  repotting: 'lastRepottedAt',
}

/**
 * Gestes notés depuis `since`, par plante.
 *
 * Le planning s'en sert pour ne pas reproposer ce qui vient d'être fait : le
 * moteur de conseils raisonne sur les dates de la plante, qui ne bougent pas
 * pour une récolte ou un semis — le journal, lui, garde la trace.
 */
export async function findCareTypesByPlantSince(
  userId: string,
  since: Date,
): Promise<Map<string, Set<CareLogType>>> {
  const logs = await prisma.careLog.findMany({
    where: { occurredAt: { gte: since }, plantInstance: { userId } },
    select: { plantInstanceId: true, type: true },
  })

  const byPlant = new Map<string, Set<CareLogType>>()
  for (const log of logs) {
    const types = byPlant.get(log.plantInstanceId) ?? new Set<CareLogType>()
    types.add(log.type as CareLogType)
    byPlant.set(log.plantInstanceId, types)
  }
  return byPlant
}

/** Historique d'une plante, du plus récent au plus ancien. */
export async function listPlantLogs(plantInstanceId: string, userId: string) {
  await assertPlantOwned(plantInstanceId, userId)

  return prisma.careLog.findMany({
    where: { plantInstanceId },
    orderBy: { occurredAt: 'desc' },
  })
}

/**
 * Enregistre un geste d'entretien.
 * @throws ServiceError('NOT_FOUND') si la plante n'est pas à l'utilisateur.
 */
export async function logCare(
  plantInstanceId: string,
  userId: string,
  input: CreateCareLogInput,
) {
  const { gardenId } = await assertPlantOwned(plantInstanceId, userId)
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date()

  const plantUpdate: Prisma.PlantInstanceUpdateInput = {}

  const dateField = PLANT_DATE_FIELD[input.type]
  if (dateField) {
    Object.assign(plantUpdate, { [dateField]: occurredAt })
  }

  // Une note de santé fait aussi l'état courant de la plante.
  if (input.type === 'health' && input.status) {
    plantUpdate.healthStatus = input.status satisfies HealthStatus
    plantUpdate.healthNote = input.note ?? null
  }

  const [log] = await prisma.$transaction([
    prisma.careLog.create({
      data: {
        plantInstanceId,
        type: input.type,
        occurredAt,
        note: input.note,
        productUsed: input.productUsed,
        status: input.status,
        quantity: input.quantity,
        unit: input.unit,
        photoUrl: input.photoUrl,
      },
    }),
    prisma.plantInstance.update({
      where: { id: plantInstanceId, userId },
      data: plantUpdate,
    }),
  ])

  if (gardenId) await invalidateGardenAdviceCache(gardenId)
  return log
}

/**
 * Raccourcis employés par le planning : marquer une action comme faite revient
 * à noter le geste correspondant.
 */
export const logWatering = (plantId: string, userId: string, note?: string) =>
  logCare(plantId, userId, { type: 'watering', note })

export const logPruning = (plantId: string, userId: string, note?: string) =>
  logCare(plantId, userId, { type: 'pruning', note })

export const logFertilizing = (plantId: string, userId: string, note?: string) =>
  logCare(plantId, userId, { type: 'fertilizing', note })

export const logTreatment = (plantId: string, userId: string, note?: string) =>
  logCare(plantId, userId, { type: 'treatment', note })

export const logRepotting = (plantId: string, userId: string, note?: string) =>
  logCare(plantId, userId, { type: 'repotting', note })

export const logHealth = (
  plantId: string,
  userId: string,
  status: HealthStatus,
  options: { note?: string; photoUrl?: string } = {},
) => logCare(plantId, userId, { type: 'health', status, ...options })
