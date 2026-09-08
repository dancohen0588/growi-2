/**
 * Service conseils — planning d'entretien et alertes du moteur de
 * recommandation, avec les contrôles d'appartenance associés.
 *
 * Le moteur lui-même vit dans `lib/recommendation/` ; ce service en est la
 * porte d'entrée pour les Server Actions, les routes API et
 * `/api/v1/planning/today`.
 */

import {
  CARE_LOG_TYPE_BY_ACTION,
  actionHorizon,
  type ActionType,
  type GardenAction,
  type MarkActionsDoneBulkInput,
  type MarkActionsDoneBulkResult,
  type UndoActionInput,
} from '@growi/shared'

import { prisma } from '@/lib/prisma'
import {
  getGardenAdvice as computeGardenAdvice,
  getPlantAdvice as computePlantAdvice,
  invalidateGardenAdviceCache,
} from '@/lib/recommendation/garden-advice-service'
import type { GardenAdviceResult, PlantAdvice } from '@/lib/recommendation/types'
import {
  assertGardenOwned,
  listGardens,
  setPlanningClearedOn,
} from '@/lib/services/garden.service'
import { deleteCareLog, logCare } from '@/lib/services/log.service'
import {
  completeTask,
  listOpenTasksAsActions,
  reopenTask,
} from '@/lib/services/task.service'
import { getUserTimezone } from '@/lib/services/user.service'
import { zonedDayIso } from '@/lib/zoned-day'

export { invalidateGardenAdviceCache }

/**
 * Retire les actions du moteur mises en pause par « Ignorer pour aujourd'hui ».
 *
 * Deux choses ne sont jamais masquées : les tâches issues d'un diagnostic —
 * l'utilisateur les a acceptées une à une, les faire disparaître d'un geste
 * global serait les lui reprendre — et ce qui n'est dû ni aujourd'hui ni ce
 * mois-ci, qu'il n'a pas demandé à écarter.
 */
function applyClear(
  actions: GardenAction[],
  clearedOn: string | null | undefined,
  today: string,
): GardenAction[] {
  if (clearedOn !== today) return actions

  return actions.filter((action) => {
    if (action.source === 'task') return true
    const horizon = actionHorizon(action, today)
    return horizon !== 'today' && horizon !== 'month'
  })
}

/**
 * Assemble le planning d'un jardin : les tâches acceptées, puis les actions du
 * moteur, moins ce que l'utilisateur a demandé d'ignorer aujourd'hui.
 *
 * La fusion est faite ici, **après** lecture du cache de conseils : les tâches
 * ne transitent donc pas par `GardenAdviceCache`, ce qui évite d'avoir à
 * l'invalider et surtout la latence de six heures avant qu'une tâche à peine
 * planifiée n'apparaisse.
 *
 * Les trois portes du service passent par cette fonction — en rater une, c'est
 * une surface entière qui ignore les tâches ou le masquage.
 */
async function assemble(
  advice: GardenAdviceResult,
  userId: string,
  garden: { id: string; planningClearedOn: string | null },
  today: string,
): Promise<GardenAdviceResult> {
  const tasks = await listOpenTasksAsActions(userId, { gardenId: garden.id })
  const actions = applyClear(advice.actions, garden.planningClearedOn, today)

  // En tête de liste : ce sont des actions que l'utilisateur a lui-même
  // validées depuis un diagnostic, là où le reste est proposé par le moteur.
  // Les écrans regroupent ensuite par échéance sans retrier, l'ordre tient.
  return { ...advice, actions: [...tasks, ...actions] }
}

/** Le jour de l'utilisateur, celui auquel tout le planning se compare. */
async function userToday(userId: string, now: Date): Promise<string> {
  return zonedDayIso(now, await getUserTimezone(userId))
}

/** Conseils du jardin. @throws ServiceError('NOT_FOUND') si le jardin n'est pas à l'utilisateur. */
export async function getGardenAdvice(
  gardenId: string,
  userId: string,
  now: Date = new Date(),
): Promise<GardenAdviceResult> {
  const garden = await assertGardenOwned(gardenId, userId)
  const [advice, today] = await Promise.all([
    computeGardenAdvice(gardenId, userId),
    userToday(userId, now),
  ])

  return assemble(advice, userId, garden, today)
}

/**
 * Conseils d'une plante. Le moteur filtre déjà sur `userId`.
 *
 * Le masquage s'applique ici aussi : une plante dont le jardin est en pause ne
 * doit pas rouvrir par sa fiche ce que le calendrier vient de refermer.
 */
export async function getPlantAdvice(
  plantInstanceId: string,
  userId: string,
  now: Date = new Date(),
): Promise<PlantAdvice> {
  const [advice, tasks, today, plant] = await Promise.all([
    computePlantAdvice(plantInstanceId, userId),
    listOpenTasksAsActions(userId, { plantInstanceId }),
    userToday(userId, now),
    prisma.plantInstance.findFirst({
      where: { id: plantInstanceId, userId },
      select: { garden: { select: { planningClearedOn: true } } },
    }),
  ])

  const kept = applyClear(advice.tasks, plant?.garden?.planningClearedOn, today)
  return { ...advice, tasks: [...tasks, ...kept] }
}

/**
 * Conseils de tous les jardins de l'utilisateur, du plus récent au plus ancien.
 *
 * L'écran d'accueil du mobile les présente en sections, le calendrier web les
 * réunit en une liste : ne retenir que le dernier jardin reviendrait à taire
 * le travail à faire dans les autres — c'est exactement ce que faisait le web,
 * qui semblait alors avoir perdu les jardins créés depuis l'app. Une erreur du
 * moteur sur un jardin n'en fait pas disparaître les autres.
 */
export async function getGardensAdvice(
  userId: string,
  now: Date = new Date(),
): Promise<
  Array<{
    garden: { id: string; name: string; clearedToday: boolean }
    advice: GardenAdviceResult | null
  }>
> {
  const [gardens, today] = await Promise.all([listGardens(userId), userToday(userId, now)])

  return Promise.all(
    gardens.map(async (garden) => {
      const summary = {
        id: garden.id,
        name: garden.name,
        clearedToday: garden.planningClearedOn === today,
      }

      try {
        const advice = await computeGardenAdvice(garden.id, userId)
        return { garden: summary, advice: await assemble(advice, userId, garden, today) }
      } catch (err) {
        console.error('[advice.service] getGardensAdvice:', garden.id, err)
        return { garden: summary, advice: null }
      }
    }),
  )
}

/**
 * Marque une action du planning comme faite : enregistre le geste
 * correspondant sur la plante, puis invalide le cache de conseils du jardin.
 *
 * Renvoie l'identifiant du geste écrit, sans lequel « Annuler » n'aurait rien
 * à effacer. Il est nul quand l'action n'a produit aucun geste — une tâche
 * sans plante.
 */
export async function markActionDone(
  userId: string,
  params: { gardenId: string; actionType?: string; plantId?: string; taskId?: string },
): Promise<{ careLogId: string | null }> {
  const { gardenId, actionType, plantId, taskId } = params
  await assertGardenOwned(gardenId, userId)

  const careType = actionType
    ? CARE_LOG_TYPE_BY_ACTION[actionType as ActionType]
    : undefined

  // Une tâche planifiée s'acquitte par son identifiant : deux tâches de même
  // geste, issues de deux diagnostics, ne doivent pas se cocher ensemble.
  // L'appartenance est vérifiée là, et le geste est noté comme pour le moteur.
  if (taskId) await completeTask(userId, taskId)

  const log = plantId && careType ? await logCare(plantId, userId, { type: careType }) : null

  await invalidateGardenAdviceCache(gardenId)
  return { careLogId: log?.id ?? null }
}

/**
 * Marque plusieurs actions comme faites en un seul geste — « Tout arrosé »,
 * « Tout marquer comme fait ».
 *
 * Un contrôle d'appartenance, une transaction, une invalidation de cache. En
 * enchaînant N appels unitaires côté client, on invalidait le cache N fois et
 * la liste clignotait à chaque aller-retour.
 *
 * Un item en échec — plante supprimée entre-temps, tâche déjà retirée —
 * n'annule pas les autres : il est compté dans `skipped`. Une tournée de jardin
 * à moitié faite vaut mieux qu'une tournée annulée pour un pied disparu.
 */
export async function markActionsDone(
  userId: string,
  input: MarkActionsDoneBulkInput,
): Promise<MarkActionsDoneBulkResult> {
  await assertGardenOwned(input.gardenId, userId)

  let done = 0
  let skipped = 0
  const careLogIds: string[] = []

  for (const item of input.items) {
    const careType = CARE_LOG_TYPE_BY_ACTION[item.actionType]

    try {
      // Une transaction par item, et non une pour toute la tournée : Postgres
      // annulerait l'ensemble sur la moindre plante disparue, et l'utilisateur
      // qui a bien arrosé les quatre autres ne le retrouverait nulle part.
      const log = await prisma.$transaction(async (tx) => {
        if (item.taskId) await completeTask(userId, item.taskId, new Date(), tx)
        if (!item.plantId || !careType) return null
        return logCare(item.plantId, userId, { type: careType }, tx)
      })

      done += 1
      if (log) careLogIds.push(log.id)
    } catch (err) {
      console.error('[advice.service] markActionsDone, item ignoré :', item, err)
      skipped += 1
    }
  }

  await invalidateGardenAdviceCache(input.gardenId)
  return { done, skipped, careLogIds }
}

/**
 * « Ignorer pour aujourd'hui », et son « Rétablir ».
 *
 * Rien n'est écrit au journal des plantes : c'est toute la différence avec
 * « Tout marquer comme fait ». Le jour est celui de l'utilisateur — à 23 h 30
 * à Paris, un calcul en UTC lèverait le masquage à 2 h du matin.
 */
export async function clearPlanningToday(
  userId: string,
  input: { gardenId: string; undo?: boolean },
  now: Date = new Date(),
): Promise<void> {
  const day = input.undo ? null : await userToday(userId, now)
  await setPlanningClearedOn(input.gardenId, userId, day)
}

/**
 * Annule un geste noté par erreur.
 *
 * Trois effets, et il en manquait deux : le geste est effacé du journal, la
 * date `last*At` de la plante est recalculée depuis le geste précédent, et la
 * tâche qu'il avait acquittée se rouvre. Jusqu'ici « Annuler » ne faisait
 * disparaître la ligne qu'à l'écran, et la plante restait arrosée.
 *
 * @throws ServiceError('NOT_FOUND') si le jardin ou le geste n'est pas à
 * l'utilisateur.
 */
export async function undoAction(userId: string, input: UndoActionInput): Promise<void> {
  await assertGardenOwned(input.gardenId, userId)
  await deleteCareLog(input.careLogId, userId)
  if (input.taskId) await reopenTask(userId, input.taskId)

  await invalidateGardenAdviceCache(input.gardenId)
}
