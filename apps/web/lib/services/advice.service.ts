/**
 * Service conseils — planning d'entretien et alertes du moteur de
 * recommandation, avec les contrôles d'appartenance associés.
 *
 * Le moteur lui-même vit dans `lib/recommendation/` ; ce service en est la
 * porte d'entrée pour les Server Actions, les routes API et le futur endpoint
 * `/api/v1/planning/today`.
 */

import {
  getGardenAdvice as computeGardenAdvice,
  getPlantAdvice as computePlantAdvice,
  invalidateGardenAdviceCache,
} from '@/lib/recommendation/garden-advice-service'
import type { GardenAdviceResult, PlantAdvice } from '@/lib/recommendation/types'
import { assertGardenOwned, findLatestGarden } from '@/lib/services/garden.service'
import {
  logFertilizing,
  logPruning,
  logRepotting,
  logTreatment,
  logWatering,
} from '@/lib/services/log.service'

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

/** Types d'action produits par le moteur de recommandation. */
export type AdviceActionType =
  | 'arrosage'
  | 'taille'
  | 'fertilisation'
  | 'traitement'
  | 'rempotage'

/**
 * Marque une action du planning comme faite : enregistre le geste
 * correspondant sur la plante, puis invalide le cache de conseils du jardin.
 */
export async function markActionDone(
  userId: string,
  params: { gardenId: string; actionType?: string; plantId?: string },
): Promise<void> {
  const { gardenId, actionType, plantId } = params
  await assertGardenOwned(gardenId, userId)

  if (plantId) {
    switch (actionType as AdviceActionType | undefined) {
      case 'arrosage':
        await logWatering(plantId, userId)
        break
      case 'taille':
        await logPruning(plantId, userId)
        break
      case 'fertilisation':
        await logFertilizing(plantId, userId)
        break
      case 'traitement':
        await logTreatment(plantId, userId)
        break
      case 'rempotage':
        await logRepotting(plantId, userId)
        break
    }
  }

  await invalidateGardenAdviceCache(gardenId)
}
