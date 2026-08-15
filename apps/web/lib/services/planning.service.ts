/**
 * Service planning — la vue « Aujourd'hui » de l'app mobile.
 *
 * Assemble en une seule réponse ce dont l'écran d'accueil a besoin : le jardin
 * courant, les tâches à faire aujourd'hui (ou en retard), les alertes en cours
 * et la météo locale. Chaque brique reste facultative : ni l'absence de jardin
 * ni une météo indisponible ne doivent empêcher l'écran de s'afficher.
 */

// Le contrat de la réponse vit dans @growi/shared : le mobile et le web
// s'appuient sur la même définition.
import type { TodayPlanning } from '@growi/shared'

import { getCurrentGardenAdvice } from '@/lib/services/advice.service'
import { getUserLocation } from '@/lib/services/user.service'
import { getWeatherForecast } from '@/lib/services/weather.service'

export type { TodayPlanning }

/** Date du jour au format `YYYY-MM-DD`, dans le fuseau du serveur. */
function todayIsoDate(now: Date): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10)
}

export async function getTodayPlanning(
  userId: string,
  now = new Date(),
): Promise<TodayPlanning> {
  const date = todayIsoDate(now)

  const [advice, weather] = await Promise.all([
    getCurrentGardenAdvice(userId),
    getTodayWeather(userId),
  ])

  const actions = (advice?.advice?.actions ?? []).filter(
    (action) => !action.done && action.dueDate <= date,
  )

  return {
    date,
    garden: advice ? { id: advice.gardenId } : null,
    actions,
    alerts: advice?.advice?.alerts ?? [],
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
