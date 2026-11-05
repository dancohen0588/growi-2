import type { ActionWindow } from '@growi/shared'

import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { doneSince, endOfMonth, isExposed, startOfMonth } from '../utils'
import { winterProtectionOf } from '../winter-protection'

/**
 * Deux paillages par an pour les plantes qui en profitent
 * (`mulchRecommended`) : à la fin du printemps, pour garder l'humidité de
 * l'été, et à l'automne, pour protéger les racines du froid et nourrir le sol.
 *
 * Le paillage d'automne cède la place à l'hivernage (r14) quand le catalogue
 * prévoit déjà de pailler pour l'hiver : une seule carte pour un seul geste.
 */
const SEASONS = [
  {
    key: 'spring',
    months: [5, 6],
    why: "Avant les chaleurs, un paillage garde la fraîcheur au pied : tu arroseras moins souvent cet été.",
    howTo:
      "Après une bonne pluie ou un arrosage, étale 5 à 7 cm de tontes séchées, de paille ou de broyat au pied, sans toucher la tige.",
  },
  {
    key: 'autumn',
    months: [10, 11],
    why: "Les feuilles tombent : c'est le paillage le plus simple de l'année. Il protège les racines du froid et nourrit le sol tout l'hiver.",
    howTo:
      "Ramasse les feuilles mortes saines et étale-en 5 à 10 cm au pied. Évite celles des plantes malades (rosiers tachés, par exemple).",
  },
] as const

function seasonOf(month: number) {
  return SEASONS.find((season) => (season.months as readonly number[]).includes(month)) ?? null
}

export const r13Mulching: AdviceRule = {
  id: 'r13-mulching',
  name: 'Paillage',
  gestureLabel: 'Paillage',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog?.mulchRecommended) return []
    if (!isExposed(instance.location)) return []

    const season = seasonOf(currentDate.getMonth() + 1)
    if (!season) return []
    if (season.key === 'autumn' && winterProtectionOf(catalog.winterProtectionType) === 'MULCH') {
      return []
    }

    const year = currentDate.getFullYear()
    const window: ActionWindow = {
      start: startOfMonth(year, season.months[0]),
      end: endOfMonth(year, season.months[season.months.length - 1]),
    }

    // Paillé dans la saison : c'est fait jusqu'à la suivante.
    if (doneSince(ctx, this.id, window.start)) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'autre',
        label: `Paille le pied de ${plantName}`,
        shortLabel: 'Pailler',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: window.end,
        done: false,
        priority: 'low',
        kind: 'window',
        window,
        ruleId: this.id,
        why: season.why,
        howTo: season.howTo,
      },
    ]
  },
}
