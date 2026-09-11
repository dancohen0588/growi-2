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

import { trackServer } from '@/lib/analytics/server'
import { prisma } from '@/lib/prisma'
import { invalidateGardenAdviceCache } from '@/lib/recommendation/garden-advice-service'
import { ServiceError } from '@/lib/services/errors'
import { assertPlantOwned } from '@/lib/services/plant.service'
import { completeTasksForGesture } from '@/lib/services/task.service'

/**
 * Date de la plante à faire avancer selon le geste.
 *
 * C'est par ces champs que le moteur de conseils raisonne — il ne lit pas les
 * logs. Un geste sans date associée (semis, autre) n'a donc pas d'incidence
 * sur le planning, seulement sur l'historique.
 *
 * La récolte en fait partie depuis la v2 du planning : rien ne fermait la
 * règle r8, qui reproposait la même récolte chaque matin de toute la saison.
 */
const PLANT_DATE_FIELD: Partial<Record<CareLogType, keyof Prisma.PlantInstanceUpdateInput>> = {
  watering: 'lastWateredAt',
  pruning: 'lastPrunedAt',
  fertilizing: 'lastFertilizedAt',
  treatment: 'lastTreatedAt',
  repotting: 'lastRepottedAt',
  harvest: 'lastHarvestedAt',
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
 *
 * `tx` permet d'enchaîner plusieurs gestes dans une seule transaction — la
 * tournée d'arrosage de « Tout arrosé ». L'appelant prend alors deux
 * responsabilités à sa charge : ouvrir la transaction, et invalider le cache
 * de conseils **une fois** à la fin plutôt qu'à chaque plante.
 *
 * @throws ServiceError('NOT_FOUND') si la plante n'est pas à l'utilisateur.
 */
/**
 * D'où vient le geste noté.
 *
 * Le service ne peut pas le deviner — c'est la même écriture depuis la fiche,
 * depuis le planning ou depuis le fil de discussion. Or c'est justement la
 * question produit : le planning fait-il faire des gestes, ou les gens
 * notent-ils ce qu'ils auraient fait de toute façon ?
 */
export type CareSource = 'detail' | 'planning' | 'chat'

export async function logCare(
  plantInstanceId: string,
  userId: string,
  input: CreateCareLogInput,
  tx?: Prisma.TransactionClient,
  source: CareSource = 'detail',
) {
  const db = tx ?? prisma
  const { gardenId } = await assertPlantOwned(plantInstanceId, userId, db)
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

  const writes = (client: Prisma.TransactionClient) =>
    Promise.all([
      client.careLog.create({
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
      client.plantInstance.update({
        where: { id: plantInstanceId, userId },
        data: plantUpdate,
      }),
    ])

  // Déjà dans une transaction : en ouvrir une seconde à l'intérieur échouerait.
  const [log] = tx ? await writes(tx) : await prisma.$transaction(writes)

  // Le geste accomplit de fait les tâches échues du même type : sans cela,
  // arroser depuis la fiche masquerait la tâche « Arrose ce soir » du planning
  // — le moteur écarte ce qui a été fait aujourd'hui — sans jamais la clore.
  // Elle reviendrait le lendemain, alors que l'utilisateur a bien arrosé.
  await completeTasksForGesture(userId, plantInstanceId, input.type, occurredAt, db)

  if (gardenId && !tx) await invalidateGardenAdviceCache(gardenId)

  trackServer(userId, 'care_logged', { type: input.type, from: source })

  return log
}

/**
 * Efface un geste et remet la plante dans l'état d'avant.
 *
 * La date `last*At` est **recalculée** depuis le dernier geste restant du même
 * type, jamais simplement remise à `null` : effacer l'arrosage de ce matin ne
 * doit pas faire croire que la plante n'a jamais été arrosée.
 *
 * @throws ServiceError('NOT_FOUND') si le geste n'est pas à l'utilisateur.
 */
export async function deleteCareLog(careLogId: string, userId: string) {
  const log = await prisma.careLog.findFirst({
    where: { id: careLogId, plantInstance: { userId } },
    select: { id: true, type: true, plantInstanceId: true, plantInstance: { select: { gardenId: true } } },
  })
  if (!log) throw new ServiceError('NOT_FOUND', 'Geste introuvable')

  const type = log.type as CareLogType
  const dateField = PLANT_DATE_FIELD[type]

  await prisma.$transaction(async (tx) => {
    await tx.careLog.delete({ where: { id: log.id } })

    if (!dateField) return

    const previous = await tx.careLog.findFirst({
      where: { plantInstanceId: log.plantInstanceId, type },
      orderBy: { occurredAt: 'desc' },
      select: { occurredAt: true },
    })

    await tx.plantInstance.update({
      where: { id: log.plantInstanceId, userId },
      data: { [dateField]: previous?.occurredAt ?? null },
    })
  })

  const gardenId = log.plantInstance.gardenId
  if (gardenId) await invalidateGardenAdviceCache(gardenId)

  return { plantInstanceId: log.plantInstanceId, type, gardenId }
}

/**
 * Les gestes notés depuis `since`, avec de quoi les afficher.
 *
 * Sert la section « Fait aujourd'hui » : elle a besoin du geste lui-même —
 * son identifiant, pour l'annuler — là où `findCareTypesByPlantSince` ne
 * répond qu'à la question « ce geste a-t-il été fait ? ».
 */
export async function listCareLogsSince(userId: string, since: Date) {
  return prisma.careLog.findMany({
    where: { occurredAt: { gte: since }, plantInstance: { userId } },
    orderBy: { occurredAt: 'desc' },
    select: {
      id: true,
      type: true,
      occurredAt: true,
      plantInstanceId: true,
      plantInstance: {
        select: {
          customName: true,
          emoji: true,
          photoUrl: true,
          catalogPlant: { select: { commonName: true, emoji: true, imageUrl: true } },
        },
      },
    },
  })
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
