import type { AdviceRule, PlantContext, GardenAction } from '../types'

const MS_PER_DAY = 86_400_000

export const r8Harvest: AdviceRule = {
  id: 'r8-harvest',
  name: 'Récolte imminente',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, currentDate } = ctx
    const catalog = instance.catalogPlant

    const currentMonth = currentDate.getMonth() + 1
    const plantName = instance.customName ?? catalog?.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog?.emoji ?? ''

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

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'recolte',
        label: `${plantName} est prêt(e) à récolter ! ${emoji}`.trim(),
        shortLabel: 'Récolter',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: currentDate.toISOString().slice(0, 10),
        done: false,
        priority: 'high',
      },
    ]
  },
}
