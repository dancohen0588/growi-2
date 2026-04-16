import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { isMonthIn } from '../utils'

export const r6SowingIndoor: AdviceRule = {
  id: 'r6-sowing-indoor',
  name: 'Semis en intérieur',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog) return []

    const currentMonth = currentDate.getMonth() + 1
    if (!isMonthIn(currentMonth, catalog.sowingMonthsIndoor)) return []

    const isIndoor =
      instance.location === 'INDOOR' ||
      instance.location === 'GREENHOUSE' ||
      catalog.indoor === true

    if (!isIndoor) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''

    const dueDate = new Date(currentDate)
    dueDate.setDate(dueDate.getDate() + 3)

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'semis',
        label: `Sème ${plantName} en intérieur 🌱`,
        shortLabel: 'Semer',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: dueDate.toISOString().slice(0, 10),
        done: false,
        priority: 'medium',
      },
    ]
  },
}
