import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { getCurrentSeason, daysSince } from '../utils'

export const r12PreventiveTreatment: AdviceRule = {
  id: 'r12-preventive-treatment',
  name: 'Traitement préventif',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog) return []

    let seasonStrings: string[] = []
    if (catalog.treatmentSeasons) {
      try {
        const parsed = JSON.parse(catalog.treatmentSeasons)
        if (Array.isArray(parsed)) seasonStrings = parsed
      } catch { /* ignore */ }
    }
    if (seasonStrings.length === 0) return []

    const currentSeason = getCurrentSeason(currentDate.getMonth() + 1)
    if (!seasonStrings.includes(currentSeason)) return []

    if (daysSince(instance.lastTreatedAt, currentDate) < 90) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'traitement',
        label: `Traitement préventif recommandé — ${plantName} 🛡️`,
        shortLabel: 'Traiter',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: currentDate.toISOString().slice(0, 10),
        done: false,
        priority: 'low',
      },
    ]
  },
}
