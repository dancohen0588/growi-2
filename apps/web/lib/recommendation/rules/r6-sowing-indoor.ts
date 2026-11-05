import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { doneSince, monthRunWindow, parseJsonArray } from '../utils'

/**
 * Ce qu'on sème chaque année. Un Monstera porte parfois des mois de semis au
 * catalogue ; proposer de « semer » la plante verte qui trône dans le salon
 * n'avait aucun sens.
 */
const SOWN_CATEGORIES = new Set(['VEGETABLE', 'HERBS', 'FLOWERS'])

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

    if (!SOWN_CATEGORIES.has(catalog.category) || instance.isMultiYear === true) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''

    // Un semis se fait dans une période, pas un jour : l'échéance à trois jours
    // faisait revenir la carte en retard le quatrième, pour un mois entier.
    const window = monthRunWindow(months, currentDate)

    // Semé dans la fenêtre : c'est fait pour la saison. Le semis ne pose
    // aucune date sur la plante, la carte revenait donc chaque matin.
    if (doneSince(ctx, this.id, window.start)) return []

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
