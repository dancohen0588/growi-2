import type { AdviceRule, PlantContext, GardenAction } from '../types'

const MS_PER_DAY = 86_400_000

/**
 * Au-delà, l'arrosage annoncé n'apprend plus rien : les sections « demain » et
 * « plus tard » se rempliraient de dates trop lointaines pour être utiles.
 */
const FORECAST_HORIZON_DAYS = 14

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10)
}

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

    // Arrosée récemment : on annonce la prochaine fois plutôt que de se taire.
    // C'est ce qui alimente « à faire demain » et « à faire plus tard » ; sans
    // cela ces sections resteraient vides, le moteur ne parlant que du présent.
    if (instance.lastWateredAt) {
      const lastWatered = new Date(instance.lastWateredAt)
      const elapsed = (currentDate.getTime() - lastWatered.getTime()) / MS_PER_DAY

      if (elapsed < adjustedFreq) {
        const remaining = adjustedFreq - elapsed
        if (remaining > FORECAST_HORIZON_DAYS) return []

        const next = new Date(currentDate.getTime() + Math.ceil(remaining) * MS_PER_DAY)

        return [
          {
            id: `${this.id}:${instance.id}`,
            type: 'arrosage',
            label: `Arrose ${plantName} ${emoji}`.trim(),
            shortLabel: 'Arroser',
            plantId: instance.id,
            plantName,
            plantEmoji: emoji,
            dueDate: isoDay(next),
            done: false,
            // À venir : ne doit pas concurrencer ce qui est dû aujourd'hui.
            priority: 'low',
            recurringDays: freqDays,
          },
        ]
      }
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
        dueDate: isoDay(currentDate),
        done: false,
        priority: 'high',
        recurringDays: freqDays,
      },
    ]
  },
}
