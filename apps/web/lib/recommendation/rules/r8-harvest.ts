import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { daysSince, endOfMonth, isoDay, startOfMonth } from '../utils'

const MS_PER_DAY = 86_400_000

/**
 * Une récolte notée ferme la règle une semaine.
 *
 * C'est ce qui manquait le plus : rien ne clôturait r8, faute de date de
 * dernière récolte sur la plante. La carte ressortait donc chaque matin, en
 * priorité haute, pendant toute la saison — un potager de cinq pieds suffisait
 * à noyer « Aujourd'hui ». Sept jours, parce qu'on récolte des tomates par
 * passages successifs, pas une fois pour toutes.
 */
const HARVEST_QUIET_DAYS = 7

export const r8Harvest: AdviceRule = {
  id: 'r8-harvest',
  name: 'Récolte imminente',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, currentDate } = ctx
    const catalog = instance.catalogPlant

    const currentMonth = currentDate.getMonth() + 1
    const plantName = instance.customName ?? catalog?.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog?.emoji ?? ''

    if (daysSince(instance.lastHarvestedAt, currentDate) < HARVEST_QUIET_DAYS) return []

    // Check harvest month range from catalog
    const inHarvestRange =
      catalog?.harvestMonthsStart != null &&
      catalog?.harvestMonthsEnd != null &&
      currentMonth >= catalog.harvestMonthsStart &&
      currentMonth <= catalog.harvestMonthsEnd

    // Check expectedHarvestDate within 7 days
    const harvestSoon =
      instance.expectedHarvestDate != null &&
      (new Date(instance.expectedHarvestDate).getTime() - currentDate.getTime()) / MS_PER_DAY <= 7 &&
      new Date(instance.expectedHarvestDate).getTime() >= currentDate.getTime()

    if (!inHarvestRange && !harvestSoon) return []

    const common = {
      id: `${this.id}:${instance.id}`,
      type: 'recolte' as const,
      label: `${plantName} est prêt(e) à récolter ! ${emoji}`.trim(),
      shortLabel: 'Récolter',
      plantId: instance.id,
      plantName,
      plantEmoji: emoji,
      done: false,
      // Une récolte est une bonne nouvelle, pas une urgence. La priorité haute
      // la plaçait au-dessus d'un arrosage en retard, ce qu'elle ne vaut pas.
      priority: 'medium' as const,
      ruleId: this.id,
    }

    // Une date de récolte attendue a été posée sur le pied et elle approche :
    // elle vaut mieux que la plage du catalogue, et fait une vraie échéance.
    // Passée, elle n'a plus rien à dire — la saison du catalogue reprend la
    // main plutôt que de laisser une date morte en tête de liste.
    if (harvestSoon && instance.expectedHarvestDate) {
      return [
        {
          ...common,
          kind: 'dated',
          dueDate: isoDay(new Date(instance.expectedHarvestDate)),
          why: 'La date de récolte que tu as notée pour ce pied approche.',
        },
      ]
    }

    const year = currentDate.getFullYear()
    const window = {
      start: startOfMonth(year, catalog?.harvestMonthsStart ?? currentMonth),
      end: endOfMonth(year, catalog?.harvestMonthsEnd ?? currentMonth),
    }

    return [
      {
        ...common,
        kind: 'window',
        window,
        dueDate: window.end,
        why: 'La saison de récolte est ouverte. Cueille au fil des besoins : noter une récolte met la carte en pause une semaine.',
      },
    ]
  },
}
