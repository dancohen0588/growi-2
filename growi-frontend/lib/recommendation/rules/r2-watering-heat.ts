import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { r1WateringStandard } from './r1-watering-standard'

const MS_PER_DAY = 86_400_000

export const r2WateringHeat: AdviceRule = {
  id: 'r2-watering-heat',
  name: 'Arrosage canicule',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, weather, currentDate } = ctx
    const catalog = instance.catalogPlant

    const threshold = catalog?.heatStressThresholdC ?? 32
    if (weather.current.temperature <= threshold) return []

    // Skip if R1 already triggered (avoid duplicate)
    if (r1WateringStandard.evaluate(ctx).length > 0) return []

    const freqDays = instance.wateringFreqDays ?? catalog?.wateringFreqDays
    if (!freqDays || !instance.lastWateredAt) return []

    const elapsed = (currentDate.getTime() - new Date(instance.lastWateredAt).getTime()) / MS_PER_DAY
    if (elapsed < freqDays / 2) return []

    const plantName = instance.customName ?? catalog?.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog?.emoji ?? ''

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'arrosage',
        label: `Canicule : arrose ${plantName} en soirée 🌡️`,
        shortLabel: 'Arroser',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: currentDate.toISOString().slice(0, 10),
        done: false,
        priority: 'high',
      },
    ]
  },
}
