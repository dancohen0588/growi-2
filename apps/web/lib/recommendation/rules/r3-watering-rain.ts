import type { AdviceRule, PlantContext, GardenAction } from '../types'
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
        dueDate: currentDate.toISOString().slice(0, 10),
        done: true,
        priority: 'low',
      },
    ]
  },
}
