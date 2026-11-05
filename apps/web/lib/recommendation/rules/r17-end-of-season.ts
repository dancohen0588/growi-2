import type { ActionWindow } from '@growi/shared'

import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { doneSince, isFinishedAnnual } from '../utils'

const HOW_TO =
  "Coupe les tiges, arrache les racines et mets le tout au compost, sauf les pieds malades (mildiou, taches) : ceux-là partent à la poubelle. Profite de la place libre pour pailler la planche ou semer un engrais vert."

/**
 * Fin de saison des annuelles gélives restées dehors : arracher et composter.
 *
 * C'est la seule chose utile à dire d'une tomate en novembre. Le moteur
 * proposait jusque-là de l'arroser, de la pailler et de la protéger du gel.
 * Une fois par hiver, en novembre-décembre ; en janvier, la carte n'aurait
 * plus de sens que pour un jardin abandonné.
 */
export const r17EndOfSeason: AdviceRule = {
  id: 'r17-end-of-season',
  name: 'Fin de saison',
  gestureLabel: 'Fin de saison',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog || !isFinishedAnnual(ctx)) return []

    const month = currentDate.getMonth() + 1
    if (month !== 11 && month !== 12) return []

    const year = currentDate.getFullYear()
    const window: ActionWindow = { start: `${year}-11-01`, end: `${year}-12-31` }
    if (doneSince(ctx, this.id, window.start)) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'autre',
        label: `Arrache les pieds de ${plantName} et composte-les`,
        shortLabel: 'Fin de saison',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: window.end,
        done: false,
        priority: 'low',
        kind: 'window',
        window,
        ruleId: this.id,
        why: "La saison est finie : cette plante ne supporte pas le froid, et l'hiver l'a emportée. Ses pieds font un bon compost.",
        howTo: HOW_TO,
      },
    ]
  },
}
