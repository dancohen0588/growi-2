import type { AdviceRule, PlantContext, GardenAction } from '../types'

const MS_PER_DAY = 86_400_000

export const r1WateringStandard: AdviceRule = {
  id: 'r1-watering-standard',
  name: 'Arrosage standard',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, weather, currentDate } = ctx
    const catalog = instance.catalogPlant
    const freqDays = instance.wateringFreqDays ?? catalog?.wateringFreqDays
    if (!freqDays) return []

    const plantName = instance.customName ?? catalog?.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog?.emoji ?? ''

    // Weather factor
    let factor = 1.0
    if (instance.customWateringAdjFactor != null) {
      factor = instance.customWateringAdjFactor
    } else if (weather.current.temperature > 28 && catalog?.wateringAdjHeat != null) {
      factor = catalog.wateringAdjHeat
    }

    const adjustedFreq = freqDays * factor

    // Check days since last watering
    if (instance.lastWateredAt) {
      const elapsed = (currentDate.getTime() - new Date(instance.lastWateredAt).getTime()) / MS_PER_DAY
      if (elapsed < adjustedFreq) return []
    }

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'arrosage',
        label: `Arrose ${plantName} ${emoji}`.trim(),
        shortLabel: 'Arroser',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: currentDate.toISOString().slice(0, 10),
        done: false,
        priority: 'high',
        recurringDays: freqDays,
      },
    ]
  },
}
