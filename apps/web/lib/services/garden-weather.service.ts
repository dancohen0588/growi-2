/**
 * Service météo du jardin.
 *
 * La page Météo du web construit son contexte dans le navigateur ; le mobile
 * ne peut pas en faire autant sans embarquer le catalogue et les règles. On
 * assemble donc ici la même chose, à partir des mêmes fonctions, pour que les
 * deux plateformes donnent le même diagnostic.
 */

import { buildWeeklyTips, type GardenWeather } from '@growi/shared'

import { buildGardenContext } from '@/lib/garden-context'
import { toPlant } from '@/lib/plant-mapper'
import { ServiceError } from '@/lib/services/errors'
import { listPlantInstances } from '@/lib/services/plant.service'
import { getUserLocation } from '@/lib/services/user.service'
import { getWeatherForecast } from '@/lib/services/weather.service'

export type { GardenWeather }

/**
 * Météo, contexte et conseils pour le jardin de l'utilisateur.
 *
 * @throws ServiceError('INVALID_INPUT') si aucune position n'est enregistrée —
 * sans coordonnées il n'y a pas de météo à donner, et c'est à l'écran d'y
 * envoyer l'utilisateur plutôt que d'afficher un vide.
 */
export async function getGardenWeather(userId: string): Promise<GardenWeather> {
  const location = await getUserLocation(userId)

  if (location?.latitude == null || location?.longitude == null) {
    throw new ServiceError(
      'INVALID_INPUT',
      'Renseigne ta position dans ton profil pour voir la météo de ton jardin.',
    )
  }

  const [weather, instances] = await Promise.all([
    getWeatherForecast(location.latitude, location.longitude),
    listPlantInstances(userId),
  ])

  // Le contexte se nourrit des plantes : sans elles, il n'y a rien à en dire.
  const plants = instances.map(toPlant)
  const context =
    plants.length > 0
      ? buildGardenContext(
          location.latitude,
          location.longitude,
          weather.elevation,
          weather,
          plants,
        )
      : null

  return {
    locationName: weather.locationName,
    current: weather.current,
    forecast: weather.forecast,
    context,
    tips: context ? buildWeeklyTips(context, weather.forecast) : [],
  }
}
