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
import {
  ACTION_TYPE_LABELS,
  CARE_LOG_TYPE_BY_ACTION,
  type ActionType,
  type CareLogType,
  type GardenAction,
  type TodayPlanning,
} from '@growi/shared'

import { getGardensAdvice } from '@/lib/services/advice.service'
import { listCareLogsSince } from '@/lib/services/log.service'
import { getUserLocation, getUserTimezone } from '@/lib/services/user.service'
import { getWeatherForecast } from '@/lib/services/weather.service'
import { safeTimeZone, startOfZonedDay, zonedDayIso } from '@/lib/zoned-day'

export type { TodayPlanning }

/** Geste du journal → tâche du planning qu'il accomplit. */
const ACTION_TYPE_BY_CARE_LOG = Object.fromEntries(
  Object.entries(CARE_LOG_TYPE_BY_ACTION).map(([action, care]) => [care, action]),
) as Record<CareLogType, ActionType>

export async function getTodayPlanning(
  userId: string,
  now = new Date(),
): Promise<TodayPlanning> {
  // Le jour de l'utilisateur, pas celui du serveur : c'est lui qui décide de
  // ce qui est « fait aujourd'hui » et de ce qui est dû.
  const zone = safeTimeZone(await getUserTimezone(userId))
  const date = zonedDayIso(now, zone)

  const [gardensAdvice, logsToday, weather] = await Promise.all([
    getGardensAdvice(userId, now),
    listCareLogsSince(userId, startOfZonedDay(now, zone)),
    getTodayWeather(userId),
  ])

  const doneTypesByPlant = new Map<string, Set<CareLogType>>()
  for (const log of logsToday) {
    const types = doneTypesByPlant.get(log.plantInstanceId) ?? new Set<CareLogType>()
    types.add(log.type as CareLogType)
    doneTypesByPlant.set(log.plantInstanceId, types)
  }
  const doneToday = logsToday.map(toDoneAction).filter((action): action is GardenAction => !!action)

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
    (doneTypesByPlant.get(action.plantId)?.has(CARE_LOG_TYPE_BY_ACTION[action.type]) ?? false)

  const gardens = gardensAdvice.map(({ garden, advice }) => {
    const actions = (advice?.actions ?? []).filter((action) => {
      if (!isPending(action) || isDoneToday(action) || seenActionIds.has(action.id)) return false
      seenActionIds.add(action.id)
      return true
    })

    return {
      id: garden.id,
      name: garden.name,
      actions,
      alerts: advice?.alerts ?? [],
      clearedToday: garden.clearedToday,
    }
  })

  return {
    date,
    gardens,
    doneToday,
    weather: weather
      ? {
          locationName: weather.locationName,
          current: weather.current,
          today: weather.forecast.find((day) => day.date === date) ?? weather.forecast[0] ?? null,
        }
      : null,
  }
}

type CareLogRow = Awaited<ReturnType<typeof listCareLogsSince>>[number]

/**
 * Un geste noté aujourd'hui, présenté comme l'action qu'il a accomplie.
 *
 * Les notes de santé et les gestes « autre » n'ont pas d'action correspondante
 * dans le planning : les faire figurer dans « Fait aujourd'hui » laisserait
 * croire qu'on vient d'y cocher quelque chose.
 */
function toDoneAction(log: CareLogRow): GardenAction | null {
  const type = ACTION_TYPE_BY_CARE_LOG[log.type as CareLogType]
  if (!type || type === 'autre') return null

  const plant = log.plantInstance
  const catalog = plant.catalogPlant
  const plantName = plant.customName ?? catalog?.commonName ?? 'Plante'

  return {
    id: `log:${log.id}`,
    type,
    label: `${ACTION_TYPE_LABELS[type]} · ${plantName}`,
    shortLabel: ACTION_TYPE_LABELS[type],
    plantId: log.plantInstanceId,
    plantName,
    plantEmoji: plant.emoji ?? catalog?.emoji ?? '',
    plantPhotoUrl: plant.photoUrl ?? catalog?.imageUrl ?? null,
    dueDate: log.occurredAt.toISOString().slice(0, 10),
    done: true,
    doneAt: log.occurredAt.toISOString(),
    priority: 'low',
    careLogId: log.id,
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
