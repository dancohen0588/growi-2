/**
 * Service conseils — planning d'entretien et alertes du moteur de
 * recommandation, avec les contrôles d'appartenance associés.
 *
 * Le moteur lui-même vit dans `lib/recommendation/` ; ce service en est la
 * porte d'entrée pour les Server Actions, les routes API et le futur endpoint
 * `/api/v1/planning/today`.
 */

import { CARE_LOG_TYPE_BY_ACTION, type ActionType } from '@growi/shared'

import {
  getGardenAdvice as computeGardenAdvice,
  getPlantAdvice as computePlantAdvice,
  invalidateGardenAdviceCache,
} from '@/lib/recommendation/garden-advice-service'
import type { GardenAdviceResult, PlantAdvice } from '@/lib/recommendation/types'
import {
  assertGardenOwned,
  findLatestGarden,
  listGardens,
} from '@/lib/services/garden.service'
import { logCare } from '@/lib/services/log.service'
import { completeTask, listOpenTasksAsActions } from '@/lib/services/task.service'

export { invalidateGardenAdviceCache }

/**
 * Ajoute les tâches planifiées aux actions calculées par le moteur.
 *
 * La fusion est faite ici, **après** lecture du cache de conseils : les tâches
 * ne transitent donc pas par `GardenAdviceCache`, ce qui évite d'avoir à
 * l'invalider et surtout la latence de six heures avant qu'une tâche à peine
 * planifiée n'apparaisse. Toutes les surfaces qui passent par ce service en
 * héritent — calendrier web, Accueil et Calendrier mobiles, fiche plante.
 */
async function withTasks(
  advice: GardenAdviceResult,
  userId: string,
  gardenId: string,
): Promise<GardenAdviceResult> {
  const tasks = await listOpenTasksAsActions(userId, { gardenId })
  if (tasks.length === 0) return advice

  return { ...advice, actions: [...advice.actions, ...tasks] }
}

/** Conseils du jardin. @throws ServiceError('NOT_FOUND') si le jardin n'est pas à l'utilisateur. */
export async function getGardenAdvice(
  gardenId: string,
  userId: string,
): Promise<GardenAdviceResult> {
  await assertGardenOwned(gardenId, userId)
  return withTasks(await computeGardenAdvice(gardenId, userId), userId, gardenId)
}

/** Conseils d'une plante. Le moteur filtre déjà sur `userId`. */
export async function getPlantAdvice(
  plantInstanceId: string,
  userId: string,
): Promise<PlantAdvice> {
  const advice = await computePlantAdvice(plantInstanceId, userId)
  const tasks = await listOpenTasksAsActions(userId, { plantInstanceId })

  return tasks.length > 0 ? { ...advice, tasks: [...advice.tasks, ...tasks] } : advice
}

/**
 * Conseils du jardin courant (le plus récent), ou `null` si l'utilisateur n'a
 * pas encore de jardin. Une erreur du moteur n'est pas fatale : l'écran doit
 * s'afficher même sans recommandation.
 */
export async function getCurrentGardenAdvice(userId: string): Promise<{
  gardenId: string
  advice: GardenAdviceResult | null
} | null> {
  const garden = await findLatestGarden(userId)
  if (!garden) return null

  try {
    const advice = await computeGardenAdvice(garden.id, userId)
    return { gardenId: garden.id, advice: await withTasks(advice, userId, garden.id) }
  } catch (err) {
    console.error('[advice.service] getCurrentGardenAdvice:', err)
    return { gardenId: garden.id, advice: null }
  }
}

/**
 * Conseils de tous les jardins de l'utilisateur, du plus récent au plus ancien.
 *
 * L'écran d'accueil du mobile les présente en sections : ne retenir que le
 * dernier jardin reviendrait à taire le travail à faire dans les autres. Une
 * erreur du moteur sur un jardin n'en fait pas disparaître les autres.
 */
export async function getGardensAdvice(userId: string): Promise<
  Array<{ garden: { id: string; name: string }; advice: GardenAdviceResult | null }>
> {
  const gardens = await listGardens(userId)

  return Promise.all(
    gardens.map(async (garden) => {
      try {
        const advice = await computeGardenAdvice(garden.id, userId)
        return {
          garden: { id: garden.id, name: garden.name },
          advice: await withTasks(advice, userId, garden.id),
        }
      } catch (err) {
        console.error('[advice.service] getGardensAdvice:', garden.id, err)
        return { garden: { id: garden.id, name: garden.name }, advice: null }
      }
    }),
  )
}

/**
 * Marque une action du planning comme faite : enregistre le geste
 * correspondant sur la plante, puis invalide le cache de conseils du jardin.
 *
 * Depuis l'unification du journal, les sept types de tâches ont leur geste —
 * la récolte et le semis, jusque-là silencieusement ignorés, sont notés comme
 * les autres.
 */
export async function markActionDone(
  userId: string,
  params: { gardenId: string; actionType?: string; plantId?: string; taskId?: string },
): Promise<void> {
  const { gardenId, actionType, plantId, taskId } = params
  await assertGardenOwned(gardenId, userId)

  const careType = actionType
    ? CARE_LOG_TYPE_BY_ACTION[actionType as ActionType]
    : undefined

  // Une tâche planifiée s'acquitte par son identifiant : deux tâches de même
  // geste, issues de deux diagnostics, ne doivent pas se cocher ensemble.
  // L'appartenance est vérifiée là, et le geste est noté comme pour le moteur.
  if (taskId) await completeTask(userId, taskId)

  if (plantId && careType) {
    await logCare(plantId, userId, { type: careType })
  }

  await invalidateGardenAdviceCache(gardenId)
}
