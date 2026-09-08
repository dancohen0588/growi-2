import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { isoDay } from '../utils'

const MS_PER_DAY = 86_400_000

/**
 * Au-delà, l'arrosage annoncé n'apprend plus rien : les sections « cette
 * semaine » et « plus tard » se rempliraient de dates trop lointaines pour
 * être utiles.
 */
const FORECAST_HORIZON_DAYS = 14

/** « il y a 4 jours », « hier », « aujourd'hui » — de quoi écrire une phrase. */
function agoInDays(days: number): string {
  const rounded = Math.floor(days)
  if (rounded <= 0) return "aujourd'hui"
  if (rounded === 1) return 'hier'
  return `il y a ${rounded} jours`
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
    // Une fréquence resserrée par la chaleur se dit : sinon l'utilisateur lit
    // « fréquence 5 jours » sur une carte qui revient au bout de trois.
    const heatNote =
      adjustedFreq < freqDays ? ` La chaleur resserre le rythme à ${Math.round(adjustedFreq)} jours.` : ''

    const common = {
      id: `${this.id}:${instance.id}`,
      type: 'arrosage' as const,
      label: `Arrose ${plantName} ${emoji}`.trim(),
      shortLabel: 'Arroser',
      plantId: instance.id,
      plantName,
      plantEmoji: emoji,
      done: false,
      kind: 'dated' as const,
      ruleId: this.id,
      howTo: catalog?.careTipWatering ?? undefined,
      recurringDays: freqDays,
    }

    // Arrosée récemment : on annonce la prochaine fois plutôt que de se taire.
    // C'est ce qui alimente « cette semaine » et « plus tard » ; sans cela ces
    // sections resteraient vides, le moteur ne parlant que du présent.
    if (instance.lastWateredAt) {
      const lastWatered = new Date(instance.lastWateredAt)
      const elapsed = (currentDate.getTime() - lastWatered.getTime()) / MS_PER_DAY

      if (elapsed < adjustedFreq) {
        const remaining = adjustedFreq - elapsed
        if (remaining > FORECAST_HORIZON_DAYS) return []

        const next = new Date(currentDate.getTime() + Math.ceil(remaining) * MS_PER_DAY)

        return [
          {
            ...common,
            dueDate: isoDay(next),
            // À venir : ne doit pas concurrencer ce qui est dû aujourd'hui.
            priority: 'low',
            why: `Dernier arrosage ${agoInDays(elapsed)}, pour une fréquence de ${freqDays} jours.${heatNote}`,
          },
        ]
      }

      return [
        {
          ...common,
          dueDate: isoDay(currentDate),
          priority: 'high',
          why: `Dernier arrosage ${agoInDays(elapsed)}, pour une fréquence de ${freqDays} jours.${heatNote}`,
        },
      ]
    }

    return [
      {
        ...common,
        dueDate: isoDay(currentDate),
        priority: 'high',
        why: `Aucun arrosage noté depuis son ajout, pour une fréquence de ${freqDays} jours.`,
      },
    ]
  },
}
