/**
 * Service des tâches persistées du planning.
 *
 * Les actions du planning sont normalement *calculées* par le moteur de règles
 * à chaque évaluation, et mises en cache six heures. Une recommandation de
 * diagnostic acceptée par l'utilisateur ne peut pas suivre ce chemin : elle
 * doit être figée à sa date d'acceptation, puis acquittée individuellement.
 *
 * Ce module tient donc une seconde source de tâches, que `advice.service`
 * fusionne aux actions du moteur — hors cache, pour qu'une tâche planifiée
 * apparaisse à l'instant et non six heures plus tard.
 */

import {
  CARE_LOG_TYPE_BY_ACTION,
  type ActionPriority,
  type ActionType,
  type CareLogType,
  type DiagnosisPriority,
  type DiagnosisRecommendation,
  type GardenAction,
  type PlanDiagnosisResponse,
  diagnosisSuccessSchema,
} from '@growi/shared'
import type { PlantTask } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { ServiceError } from '@/lib/services/errors'

/** Échéance par défaut quand la recommandation ne porte pas de `dueInDays`. */
const DUE_IN_DAYS_BY_PRIORITY: Record<DiagnosisPriority, number> = {
  urgent: 0,
  soon: 2,
  watch: 7,
}

const PRIORITY_BY_DIAGNOSIS: Record<DiagnosisPriority, ActionPriority> = {
  urgent: 'high',
  soon: 'medium',
  watch: 'low',
}

/** Geste du journal → tâches du planning qu'il accomplit. Inverse de `CARE_LOG_TYPE_BY_ACTION`. */
const ACTION_TYPE_BY_CARE_LOG = Object.fromEntries(
  Object.entries(CARE_LOG_TYPE_BY_ACTION).map(([action, care]) => [care, action]),
) as Record<CareLogType, ActionType>

/** Longueur au-delà de laquelle un titre de carte cesse d'être lisible d'un coup d'œil. */
const SHORT_LABEL_MAX = 40

/**
 * Abrège une consigne en titre de carte.
 *
 * Repli pour les diagnostics d'avant `shortAction` : on coupe sur un mot, sans
 * ponctuation finale. Le résultat n'égale pas un titre écrit pour l'être, mais
 * il vaut mieux qu'une carte dont le titre déborde sur six lignes.
 */
export function shorten(action: string): string {
  const clean = action.trim().replace(/[.\s]+$/, '')
  if (clean.length <= SHORT_LABEL_MAX) return clean

  const cut = clean.slice(0, SHORT_LABEL_MAX)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).replace(/[,;:.\s]+$/, '')}…`
}

/** Jour civil au format `YYYY-MM-DD`, décalé de `days`. */
export function isoDay(from: Date, days = 0): string {
  const d = new Date(from)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * Traduit une recommandation en tâche planifiable.
 *
 * Les deux champs que le modèle renseigne — `actionType` et `dueInDays` — sont
 * facultatifs : les diagnostics écrits avant cette évolution n'en ont pas. Les
 * replis ne sont donc pas défensifs mais nominaux pour tout l'historique.
 */
export function toTaskDraft(
  recommendation: DiagnosisRecommendation,
  now: Date,
): {
  type: ActionType
  label: string
  shortLabel: string
  dueDate: string
  priority: ActionPriority
} {
  const dueInDays =
    recommendation.dueInDays ?? DUE_IN_DAYS_BY_PRIORITY[recommendation.priority]

  return {
    type: recommendation.actionType ?? 'autre',
    label: recommendation.action,
    shortLabel: recommendation.shortAction?.trim() || shorten(recommendation.action),
    dueDate: isoDay(now, dueInDays),
    priority: PRIORITY_BY_DIAGNOSIS[recommendation.priority],
  }
}

/**
 * Transforme les recommandations d'un diagnostic en tâches du planning.
 *
 * Idempotent : un diagnostic déjà planifié renvoie son état sans rien récrire.
 * C'est un choix délibéré plutôt qu'une erreur — le bouton peut être tapé deux
 * fois, et rouvrir un diagnostic depuis l'historique ne doit pas échouer.
 *
 * @throws ServiceError('NOT_FOUND') si le diagnostic n'est pas à l'utilisateur.
 */
export async function planDiagnosisActions(
  userId: string,
  plantInstanceId: string,
  diagnosisId: string,
  now: Date = new Date(),
): Promise<PlanDiagnosisResponse> {
  const diagnosis = await prisma.diagnosis.findFirst({
    where: { id: diagnosisId, plantInstanceId, userId },
  })
  if (!diagnosis) throw new ServiceError('NOT_FOUND', 'Diagnostic introuvable')

  if (diagnosis.tasksPlannedAt) {
    const tasksCreated = await prisma.plantTask.count({ where: { diagnosisId } })
    return { tasksCreated, tasksPlannedAt: diagnosis.tasksPlannedAt.toISOString() }
  }

  const parsed = diagnosisSuccessSchema.safeParse(diagnosis.payload)
  if (!parsed.success) {
    console.error('[task.service] payload de diagnostic illisible', diagnosisId)
    throw new ServiceError('INTERNAL', 'Ce diagnostic est illisible.')
  }

  const drafts = parsed.data.recommendations.map((r) => toTaskDraft(r, now))

  // La création des tâches et la pose du verrou vont ensemble : sans la
  // transaction, un échec au milieu laisserait des tâches sans date de
  // planification, et un second appel les dupliquerait.
  await prisma.$transaction([
    prisma.plantTask.createMany({
      data: drafts.map((draft) => ({
        ...draft,
        userId,
        plantInstanceId,
        diagnosisId,
        source: 'DIAGNOSIS',
      })),
    }),
    prisma.diagnosis.update({ where: { id: diagnosisId }, data: { tasksPlannedAt: now } }),
  ])

  return { tasksCreated: drafts.length, tasksPlannedAt: now.toISOString() }
}

type TaskWithPlant = PlantTask & {
  plantInstance: {
    id: string
    gardenId: string | null
    customName: string | null
    emoji: string | null
    photoUrl: string | null
    catalogPlant: { commonName: string; emoji: string | null; imageUrl: string | null } | null
  }
}

/** Une tâche persistée, présentée comme une action du planning. */
function toGardenAction(task: TaskWithPlant): GardenAction {
  const { plantInstance: plant } = task
  const catalog = plant.catalogPlant

  return {
    // Préfixé pour ne jamais entrer en collision avec les identifiants du
    // moteur (`r1-…`), y compris dans la déduplication de `planning.service`.
    id: `task:${task.id}`,
    type: task.type as ActionType,
    label: task.label,
    shortLabel: task.shortLabel,
    // La consigne complète, que la carte affiche sous son titre.
    detail: task.label,
    plantId: plant.id,
    plantName: plant.customName ?? catalog?.commonName ?? 'Plante',
    plantEmoji: plant.emoji ?? catalog?.emoji ?? '',
    plantPhotoUrl: plant.photoUrl ?? catalog?.imageUrl ?? null,
    dueDate: task.dueDate,
    done: false,
    priority: task.priority as ActionPriority,
    source: 'task',
    taskId: task.id,
  }
}

const PLANT_SELECT = {
  id: true,
  gardenId: true,
  customName: true,
  emoji: true,
  photoUrl: true,
  catalogPlant: { select: { commonName: true, emoji: true, imageUrl: true } },
} as const

/**
 * Tâches ouvertes de l'utilisateur, en actions du planning.
 *
 * Filtrées par jardin, les plantes **sans jardin** sont incluses : le moteur
 * les rattache lui aussi à chacun d'eux, et la déduplication de
 * `planning.service` empêche qu'elles apparaissent plusieurs fois.
 */
export async function listOpenTasksAsActions(
  userId: string,
  filter: { gardenId?: string; plantInstanceId?: string } = {},
): Promise<GardenAction[]> {
  const tasks = await prisma.plantTask.findMany({
    where: {
      userId,
      doneAt: null,
      ...(filter.plantInstanceId ? { plantInstanceId: filter.plantInstanceId } : {}),
      ...(filter.gardenId
        ? { plantInstance: { OR: [{ gardenId: filter.gardenId }, { gardenId: null }] } }
        : {}),
    },
    include: { plantInstance: { select: PLANT_SELECT } },
    orderBy: { dueDate: 'asc' },
  })

  return tasks.map(toGardenAction)
}

/**
 * Acquitte une tâche précise.
 * @throws ServiceError('NOT_FOUND') si elle n'est pas à l'utilisateur.
 */
export async function completeTask(userId: string, taskId: string, now: Date = new Date()) {
  const task = await prisma.plantTask.findFirst({ where: { id: taskId, userId } })
  if (!task) throw new ServiceError('NOT_FOUND', 'Tâche introuvable')

  // Déjà faite : ne pas déplacer la date, cocher deux fois n'est pas une erreur.
  if (task.doneAt) return task

  return prisma.plantTask.update({ where: { id: taskId }, data: { doneAt: now } })
}

/**
 * Acquitte les tâches qu'un geste vient d'accomplir de fait.
 *
 * Sans cela, arroser depuis la fiche masquerait la tâche « Arrose ce soir »
 * du planning — le moteur écarte ce qui a été fait aujourd'hui — sans jamais
 * la clore : elle reviendrait le lendemain, et la fiche la montrerait encore
 * en attente. L'utilisateur, lui, a bien arrosé.
 *
 * Ne concerne que les tâches **échues** : arroser aujourd'hui n'accomplit pas
 * un arrosage prévu la semaine prochaine.
 */
export async function completeTasksForGesture(
  userId: string,
  plantInstanceId: string,
  careType: CareLogType,
  now: Date = new Date(),
): Promise<number> {
  const actionType = ACTION_TYPE_BY_CARE_LOG[careType]
  if (!actionType) return 0

  const { count } = await prisma.plantTask.updateMany({
    where: {
      userId,
      plantInstanceId,
      type: actionType,
      doneAt: null,
      dueDate: { lte: isoDay(now) },
    },
    data: { doneAt: now },
  })

  return count
}
