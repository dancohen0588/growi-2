import type { ActionWindow } from '@growi/shared'

import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { daysSince, isoDay, lastDoneByRule, monthRunWindow, parseJsonArray } from '../utils'

const MS_PER_DAY = 86_400_000

/**
 * Un passage tous les quinze jours pendant la floraison : les fleurs ne fanent
 * pas toutes le même jour, et une fois par saison ne relancerait rien.
 */
const DEADHEADING_EVERY_DAYS = 14

const HOW_TO =
  "Coupe chaque fleur fanée juste au-dessus de la première feuille bien formée, avec un sécateur propre. Pour les petites fleurs en masse, une tonte légère aux ciseaux suffit."

/**
 * Plantes d'ornement seulement. Sur une tomate ou un pommier, ôter les fleurs,
 * c'est renoncer à la récolte ; sur un arbre, ce n'est pas un geste de
 * jardinier amateur. Les arbustes à fleurs (rosiers, hortensias…) en sont.
 */
function isOrnamental(category: string, treeType: string | null, edible: boolean): boolean {
  if (edible) return false
  if (category === 'FLOWERS') return true
  return category === 'TREES_SHRUBS' && treeType === 'SHRUB'
}

export const r15Deadheading: AdviceRule = {
  id: 'r15-deadheading',
  name: 'Fleurs fanées',
  gestureLabel: 'Fleurs fanées',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog) return []
    if (!isOrnamental(catalog.category, catalog.treeType, catalog.edible)) return []
    if (instance.healthStatus === 'CRITICAL') return []

    const months = parseJsonArray(catalog.floweringMonths)
    if (!months.includes(currentDate.getMonth() + 1)) return []

    const last = lastDoneByRule(ctx, this.id)
    if (daysSince(last, currentDate) < DEADHEADING_EVERY_DAYS) return []

    // Deux semaines devant soi, sans dépasser la fin de la floraison.
    const flowering = monthRunWindow(months, currentDate)
    const fortnight = isoDay(new Date(currentDate.getTime() + (DEADHEADING_EVERY_DAYS - 1) * MS_PER_DAY))
    const window: ActionWindow = {
      start: isoDay(currentDate),
      end: fortnight < flowering.end ? fortnight : flowering.end,
    }

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''
    const lastNote = last
      ? ` Dernier passage il y a ${Math.floor(daysSince(last, currentDate))} jours.`
      : ''

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'autre',
        label: `Retire les fleurs fanées de ${plantName}`,
        shortLabel: 'Fleurs fanées',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: window.end,
        done: false,
        priority: 'low',
        kind: 'window',
        window,
        ruleId: this.id,
        why: `Elle est en pleine floraison : retirer les fleurs fanées l'empêche de monter en graines et relance de nouveaux boutons.${lastNote}`,
        howTo: HOW_TO,
      },
    ]
  },
}
