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

export { invalidateGardenAdviceCache }

/** Conseils du jardin. @throws ServiceError('NOT_FOUND') si le jardin n'est pas à l'utilisateur. */
export async function getGardenAdvice(
  gardenId: string,
  userId: string,
): Promise<GardenAdviceResult> {
  await assertGardenOwned(gardenId, userId)
  return computeGardenAdvice(gardenId, userId)
}

/** Conseils d'une plante. Le moteur filtre déjà sur `userId`. */
export async function getPlantAdvice(
  plantInstanceId: string,
  userId: string,
): Promise<PlantAdvice> {
  return computePlantAdvice(plantInstanceId, userId)
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
    return { gardenId: garden.id, advice: await computeGardenAdvice(garden.id, userId) }
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
        return {
          garden: { id: garden.id, name: garden.name },
          advice: await computeGardenAdvice(garden.id, userId),
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
  params: { gardenId: string; actionType?: string; plantId?: string },
): Promise<void> {
  const { gardenId, actionType, plantId } = params
  await assertGardenOwned(gardenId, userId)

  const careType = actionType
    ? CARE_LOG_TYPE_BY_ACTION[actionType as ActionType]
    : undefined

  if (plantId && careType) {
    await logCare(plantId, userId, { type: careType })
  }

  await invalidateGardenAdviceCache(gardenId)
}
