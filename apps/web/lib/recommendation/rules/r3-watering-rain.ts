import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { isoDay } from '../utils'
import { r1WateringStandard } from './r1-watering-standard'

export const r3WateringRain: AdviceRule = {
  id: 'r3-watering-rain',
  name: 'Report arrosage pluie',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, weather, currentDate } = ctx
    const catalog = instance.catalogPlant

    // R1 must have been about to trigger
    if (r1WateringStandard.evaluate(ctx).length === 0) return []

    // Check precipitation in the next 24h (first day of forecast)
    const tomorrow = weather.daily[0]
    if (!tomorrow || tomorrow.precipSum <= 5) return []

    const plantName = instance.customName ?? catalog?.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog?.emoji ?? ''

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'arrosage',
        label: `Pluie prévue — arrosage reporté pour ${plantName}`,
        shortLabel: 'Reporté',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: isoDay(currentDate),
        done: true,
        priority: 'low',
        kind: 'dated',
        ruleId: this.id,
        why: `${Math.round(tomorrow.precipSum)} mm de pluie prévus : l'arrosage est reporté, la nature s'en charge.`,
      },
    ]
  },
}
