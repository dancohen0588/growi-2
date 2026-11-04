import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { isoDay } from '../utils'
import { r1WateringStandard } from './r1-watering-standard'

/** Pluie prévue sur la journée au-delà de laquelle l'arrosage est reporté. */
const FORECAST_RAIN_MM = 5

/**
 * Pluie tombée sur les trois derniers jours au-delà de laquelle le sol est
 * encore humide. Dix millimètres, c'est un bon arrosage de massif.
 */
const RECENT_RAIN_MM = 10

export const r3WateringRain: AdviceRule = {
  id: 'r3-watering-rain',
  name: 'Report arrosage pluie',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, weather, currentDate } = ctx
    const catalog = instance.catalogPlant

    // La pluie n'arrose que ce qui est dehors, en pleine terre ou en pot à
    // découvert. Le moteur reportait aussi l'arrosage du Monstera du salon.
    // Un balcon est souvent abrité : on ne parie pas sur la pluie pour lui.
    if (instance.location !== 'OUTDOOR') return []

    // R1 must have been about to trigger
    if (r1WateringStandard.evaluate(ctx).length === 0) return []

    const today = weather.daily[0]
    const forecastMm = today?.precipSum ?? 0
    const recentMm = weather.recentPrecipSum ?? 0

    const rainComing = forecastMm > FORECAST_RAIN_MM
    const rainFallen = recentMm >= RECENT_RAIN_MM
    if (!rainComing && !rainFallen) return []

    const plantName = instance.customName ?? catalog?.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog?.emoji ?? ''

    const why = rainComing
      ? `${Math.round(forecastMm)} mm de pluie prévus : l'arrosage est reporté, la nature s'en charge.`
      : `${Math.round(recentMm)} mm de pluie sont tombés ces trois derniers jours : la terre est encore humide, l'arrosage attend.`

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'arrosage',
        label: `Pluie ${rainComing ? 'prévue' : 'récente'} — arrosage reporté pour ${plantName}`,
        shortLabel: 'Reporté',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: isoDay(currentDate),
        done: true,
        priority: 'low',
        kind: 'dated',
        ruleId: this.id,
        why,
      },
    ]
  },
}
