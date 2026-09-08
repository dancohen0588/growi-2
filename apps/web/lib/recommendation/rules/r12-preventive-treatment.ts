import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { getCurrentSeason, daysSince, seasonWindow } from '../utils'

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

    // Préventif : rien ne presse au jour près, la saison suffit.
    const window = seasonWindow(currentDate)

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'traitement',
        label: `Traitement préventif recommandé — ${plantName} 🛡️`,
        shortLabel: 'Traiter',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: window.end,
        done: false,
        priority: 'low',
        kind: 'window',
        window,
        ruleId: this.id,
        why: "C'est la saison où cette plante est la plus exposée aux maladies, et aucun traitement n'a été noté depuis trois mois.",
        howTo: catalog.careTipDiseases ?? undefined,
      },
    ]
  },
}
