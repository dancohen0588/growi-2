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
  type CareLogType,
  type GardenAction,
  type MarkActionsDoneBulkInput,
  type MarkActionsDoneBulkResult,
  type UndoActionInput,
} from '@growi/shared'

import { trackServer } from '@/lib/analytics/server'
import { prisma } from '@/lib/prisma'
import {
  getGardenAdvice as computeGardenAdvice,
  getPlantAdvice as computePlantAdvice,
  invalidateGardenAdviceCache,
} from '@/lib/recommendation/garden-advice-service'
import { gestureLabelForRule } from '@/lib/recommendation/engine'
import type { GardenAdviceResult, PlantAdvice } from '@/lib/recommendation/types'
import {
  assertGardenOwned,
  listGardens,
  setPlanningClearedOn,
} from '@/lib/services/garden.service'
import { deleteCareLog, logCare, logCareBatch } from '@/lib/services/log.service'
import { awardSapMany, awardTasksOnTime, careSapLabel } from '@/lib/services/sap.service'
import {
  inferTipSlug,
  secretActionsForGarden,
  secretTitle,
  trackSecretTried,
} from '@/lib/services/secrets.service'
import {
  completeTask,
  listOpenTasksAsActions,
  reopenTask,
  secretOfTask,
} from '@/lib/services/task.service'
import { getUserTimezone } from '@/lib/services/user.service'
import { safeTimeZone, startOfZonedDay, zonedDayIso } from '@/lib/zoned-day'

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
  const [tasks, secrets] = await Promise.all([
    listOpenTasksAsActions(userId, { gardenId: garden.id }),
    // Les secrets ne passent pas par le cache du moteur : « Je tente » doit
    // retirer la carte tout de suite. Ils ne lèvent jamais.
    secretActionsForGarden(userId, garden.id, today),
  ])
  const actions = applyClear([...advice.actions, ...secrets], garden.planningClearedOn, today)

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
  params: {
    gardenId: string
    actionType?: string
    plantId?: string
    taskId?: string
    /** Règle du moteur de l'action cochée — voir `CareLog.ruleId`. */
    ruleId?: string
    /** Secret de jardinier essayé — « Je tente », ou sa préparation utilisée. */
    tipSlug?: string
  },
): Promise<{ careLogId: string | null }> {
  const { gardenId, actionType, plantId } = params
  await assertGardenOwned(gardenId, userId)

  // Une tâche planifiée s'acquitte par son identifiant : deux tâches de même
  // geste, issues de deux diagnostics, ne doivent pas se cocher ensemble.
  // L'appartenance est vérifiée là, et le geste est noté comme pour le moteur.
  const task = params.taskId ? await completeTask(userId, params.taskId) : null

  // Un secret mis à faire par « Je tente » : la tâche cochée **est** l'essai.
  // Règle et slug viennent de la tâche, quoi que le client envoie.
  const fromTask = secretOfTask(task)
  const ruleId = fromTask?.ruleId ?? params.ruleId

  // Une version de l'app qui ignore les secrets coche leur carte sans slug :
  // on le retrouve, sans quoi l'essai n'aurait ni suites ni place au grimoire.
  const tipSlug =
    fromTask?.tipSlug ??
    params.tipSlug ??
    (ruleId?.startsWith('r20-secret') && plantId
      ? await inferTipSlug(userId, { gardenId, plantId, ruleId, today: await userToday(userId, new Date()) })
      : undefined)

  const careType = actionType
    ? CARE_LOG_TYPE_BY_ACTION[actionType as ActionType]
    : undefined

  // Déjà noté aujourd'hui sur cette plante : ne pas écrire de doublon. Le
  // geste est fait, la tâche est close ; seul « Annuler » n'a rien à défaire.
  const alreadyToday =
    plantId && careType
      ? await prisma.careLog.findFirst({
          where: {
            plantInstanceId: plantId,
            plantInstance: { userId },
            type: careType,
            // Deux « autres gestes » du même jour — pailler, puis protéger du
            // froid — ne sont pas un doublon : la règle les distingue.
            ...(ruleId ? { ruleId } : {}),
            ...(tipSlug ? { tipSlug } : {}),
            occurredAt: { gte: startOfZonedDay(new Date(), safeTimeZone(await getUserTimezone(userId))) },
          },
          select: { id: true },
        })
      : null

  const log =
    plantId && careType && !alreadyToday
      ? await logCare(plantId, userId, { type: careType }, undefined, 'planning', {
          ruleId,
          tipSlug,
          // Un secret est nommé au journal par son titre : « Secret de
          // jardinier » ne dirait pas, dans un an, ce qui a été essayé.
          note:
            careType === 'other'
              ? (tipSlug ? await secretTitle(tipSlug) : undefined) ?? gestureLabelForRule(ruleId)
              : undefined,
        })
      : null

  if (log && tipSlug && ruleId?.startsWith('r20-secret')) {
    void trackSecretTried(userId, tipSlug, ruleId === 'r20-secret-ready' ? 'ready' : 'discover')
  }

  await invalidateGardenAdviceCache(gardenId)

  // `overdue_days` reste nul : les actions du moteur sont **recalculées** à
  // chaque évaluation et ne sont persistées nulle part, le serveur ne connaît
  // donc pas l'échéance de celle qu'on vient de cocher. Le client, lui, la
  // connaît — c'est là qu'il faudra la prendre le jour où le retard comptera.
  trackServer(userId, 'planning_action_done', {
    type: careType ?? 'other',
    bulk: false,
    count: 1,
    overdue_days: null,
  })

  return { careLogId: log?.id ?? null }
}

/**
 * Marque plusieurs actions comme faites en un seul geste — « Tout arrosé »,
 * « Tout marquer comme fait ».
 *
 * Un contrôle d'appartenance, **une** transaction aux requêtes groupées, une
 * invalidation de cache. La version précédente ouvrait une transaction par
 * plante : près d'une seconde chacune depuis Vercel, onze secondes pour
 * quinze plantes — et le client, rechargé entre-temps par un autre jardin,
 * voyait revenir tout ce qu'il venait de cocher.
 *
 * Un item invalide — plante supprimée entre-temps, tâche déjà retirée —
 * n'annule pas les autres : il est compté dans `skipped`. Une tournée de
 * jardin à moitié faite vaut mieux qu'une tournée annulée pour un pied
 * disparu.
 */
export async function markActionsDone(
  userId: string,
  input: MarkActionsDoneBulkInput,
  now: Date = new Date(),
): Promise<MarkActionsDoneBulkResult> {
  await assertGardenOwned(input.gardenId, userId)

  // Le jour de l'utilisateur : un arrosage déjà noté depuis minuit (Paris) ne
  // se réécrit pas. Il compte comme fait — il l'est.
  const dayStart = startOfZonedDay(now, safeTimeZone(await getUserTimezone(userId)))

  const { done, skipped, careLogIds, sapCare, sapTasks } = await prisma.$transaction(async (tx) => {
    // Les tâches planifiées s'acquittent par identifiant : deux tâches de
    // même geste issues de deux diagnostics ne se cochent pas ensemble.
    const taskIds = [...new Set(input.items.flatMap((item) => (item.taskId ? [item.taskId] : [])))]
    const ownedTasks = taskIds.length
      ? await tx.plantTask.findMany({
          where: { id: { in: taskIds }, userId },
          select: { id: true, source: true, tipSlug: true, doneAt: true, dueDate: true, shortLabel: true },
        })
      : []
    const ownedTaskIds = new Set(ownedTasks.map((task) => task.id))
    // Un secret mis à faire, coché dans « Tout marquer fait » : c'est l'essai.
    const secretByTask = new Map(ownedTasks.flatMap((task) => {
      const secret = secretOfTask(task)
      return secret ? [[task.id, secret] as const] : []
    }))

    const entries = input.items.flatMap((item) => {
      const careType = CARE_LOG_TYPE_BY_ACTION[item.actionType]
      // Une tâche sans plante ne produit aucun geste ; une tâche inconnue
      // non plus, elle est comptée en échec plus bas.
      if (!item.plantId || !careType || (item.taskId && !ownedTaskIds.has(item.taskId))) return []
      const secret = item.taskId ? secretByTask.get(item.taskId) : undefined
      const ruleId = secret?.ruleId ?? item.ruleId
      return [
        {
          plantInstanceId: item.plantId,
          type: careType,
          ruleId,
          tipSlug: secret?.tipSlug ?? item.tipSlug,
          note: careType === 'other' ? gestureLabelForRule(ruleId) : undefined,
        },
      ]
    })

    const { logs, unknownPlantIds } = await logCareBatch(userId, entries, tx, now, 'planning', {
      skipIfLoggedSince: dayStart,
    })
    const unknown = new Set(unknownPlantIds)

    if (ownedTaskIds.size > 0) {
      // Déjà faite : ne pas déplacer la date, cocher deux fois n'est pas une erreur.
      await tx.plantTask.updateMany({
        where: { id: { in: [...ownedTaskIds] }, doneAt: null },
        data: { doneAt: now },
      })
    }

    let done = 0
    let skipped = 0
    for (const item of input.items) {
      const taskMissing = !!item.taskId && !ownedTaskIds.has(item.taskId)
      const plantMissing = !!item.plantId && unknown.has(item.plantId)
      if (taskMissing || plantMissing) {
        console.error('[advice.service] markActionsDone, item ignoré :', item)
        skipped += 1
      } else {
        done += 1
      }
    }

    // De quoi créditer la sève une fois la transaction aboutie : les gestes
    // réellement écrits, et les tâches que ce geste-ci vient de cocher — une
    // tâche déjà faite ne rapporte rien une seconde fois.
    const noteByEntry = new Map(entries.map((entry) => [`${entry.plantInstanceId}:${entry.type}`, entry.note]))
    const sapCare = logs.map((log) => ({
      sourceId: log.id,
      label: careSapLabel(
        log.type as CareLogType,
        noteByEntry.get(`${log.plantInstanceId}:${log.type}`),
      ),
    }))
    const sapTasks = ownedTasks.filter((task) => !task.doneAt)

    return { done, skipped, careLogIds: logs.map((log) => log.id), sapCare, sapTasks }
  })

  await invalidateGardenAdviceCache(input.gardenId)

  await awardSapMany(userId, 'care', sapCare, now)
  await awardTasksOnTime(userId, sapTasks, now)

  // Un seul événement pour la tournée, avec son compte : c'est le geste de
  // l'utilisateur — « tout arrosé » — et non quatre gestes séparés. Le type
  // retenu est celui du premier item, tous étant du même geste dans le seul
  // parcours qui appelle cette route.
  const bulkType = input.items[0] ? CARE_LOG_TYPE_BY_ACTION[input.items[0].actionType] : undefined
  trackServer(userId, 'planning_action_done', {
    type: bulkType ?? 'other',
    bulk: true,
    count: done,
    overdue_days: null,
  })

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

  // Le rétablissement n'est pas un masquage : ne compter que la mise en
  // sourdine, sinon le taux d'« ignoré » doublerait chez qui se ravise.
  if (!input.undo) trackServer(userId, 'planning_cleared_today', { count: null })
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

  trackServer(userId, 'planning_action_undone', {})
}
