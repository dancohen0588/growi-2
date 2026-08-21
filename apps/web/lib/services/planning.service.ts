/**
 * Service planning — la vue « Aujourd'hui » de l'app mobile.
 *
 * Assemble en une seule réponse ce dont l'écran d'accueil a besoin : les
 * jardins avec leurs tâches du jour, les alertes en cours et la météo locale.
 * Chaque brique reste facultative : ni l'absence de jardin ni une météo
 * indisponible ne doivent empêcher l'écran de s'afficher.
 */

// Le contrat de la réponse vit dans @growi/shared : le mobile et le web
// s'appuient sur la même définition.
import { CARE_LOG_TYPE_BY_ACTION, type GardenAction, type TodayPlanning } from '@growi/shared'

import { getGardensAdvice } from '@/lib/services/advice.service'
import { findCareTypesByPlantSince } from '@/lib/services/log.service'
import { getUserLocation } from '@/lib/services/user.service'
import { getWeatherForecast } from '@/lib/services/weather.service'

export type { TodayPlanning }

/** Date du jour au format `YYYY-MM-DD`, dans le fuseau du serveur. */
function todayIsoDate(now: Date): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10)
}

function startOfDay(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate())
}

export async function getTodayPlanning(
  userId: string,
  now = new Date(),
): Promise<TodayPlanning> {
  const date = todayIsoDate(now)

  const [gardensAdvice, doneToday, weather] = await Promise.all([
    getGardensAdvice(userId),
    findCareTypesByPlantSince(userId, startOfDay(now)),
    getTodayWeather(userId),
  ])

  // Une plante sans jardin est rattachée à chacun d'eux par le moteur : sans
  // cette mémoire, sa tâche apparaîtrait autant de fois qu'il y a de jardins.
  const seenActionIds = new Set<string>()

  // Tout l'horizon du moteur, pas seulement le jour même : l'écran range
  // ensuite en « aujourd'hui », « demain » et « plus tard ».
  const isPending = (action: GardenAction) => !action.done

  /**
   * Fait aujourd'hui : le geste correspondant est déjà au journal.
   * Ne vaut que pour ce qui était dû — cocher aujourd'hui n'acquitte pas une
   * tâche prévue la semaine prochaine.
   */
  const isDoneToday = (action: GardenAction) =>
    action.dueDate <= date &&
    action.plantId != null &&
    (doneToday.get(action.plantId)?.has(CARE_LOG_TYPE_BY_ACTION[action.type]) ?? false)

  const gardens = gardensAdvice.map(({ garden, advice }) => {
    const actions = (advice?.actions ?? []).filter((action) => {
      if (!isPending(action) || isDoneToday(action) || seenActionIds.has(action.id)) return false
      seenActionIds.add(action.id)
      return true
    })

    return { id: garden.id, name: garden.name, actions, alerts: advice?.alerts ?? [] }
  })

  return {
    date,
    gardens,
    weather: weather
      ? {
          locationName: weather.locationName,
          current: weather.current,
          today: weather.forecast.find((day) => day.date === date) ?? weather.forecast[0] ?? null,
        }
      : null,
  }
}

/**
 * Météo du jour pour l'utilisateur, ou `null` s'il n'a pas de coordonnées
 * enregistrées ou si Open-Meteo ne répond pas.
 */
async function getTodayWeather(userId: string) {
  const location = await getUserLocation(userId)
  if (location?.latitude == null || location?.longitude == null) return null

  try {
    return await getWeatherForecast(location.latitude, location.longitude)
  } catch (err) {
    console.error('[planning.service] météo indisponible :', err)
    return null
  }
}
