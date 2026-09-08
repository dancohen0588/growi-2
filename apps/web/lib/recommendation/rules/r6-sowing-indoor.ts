import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { monthRunWindow, parseJsonArray } from '../utils'

export const r6SowingIndoor: AdviceRule = {
  id: 'r6-sowing-indoor',
  name: 'Semis en intérieur',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog) return []

    const months = parseJsonArray(catalog.sowingMonthsIndoor)
    const currentMonth = currentDate.getMonth() + 1
    if (!months.includes(currentMonth)) return []

    const isIndoor =
      instance.location === 'INDOOR' ||
      instance.location === 'GREENHOUSE' ||
      catalog.indoor === true

    if (!isIndoor) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''

    // Un semis se fait dans une période, pas un jour : l'échéance à trois jours
    // faisait revenir la carte en retard le quatrième, pour un mois entier.
    const window = monthRunWindow(months, currentDate)

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'semis',
        label: `Sème ${plantName} en intérieur 🌱`,
        shortLabel: 'Semer',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: window.end,
        done: false,
        priority: 'low',
        kind: 'window',
        window,
        ruleId: this.id,
        why: "C'est la période de semis en intérieur pour cette plante. À faire quand tu veux d'ici la fin de la fenêtre.",
      },
    ]
  },
}
