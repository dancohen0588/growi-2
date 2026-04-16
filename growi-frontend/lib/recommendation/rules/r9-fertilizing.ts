import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { parseMonthsCsv, daysSince } from '../utils'

export const r9Fertilizing: AdviceRule = {
  id: 'r9-fertilizing',
  name: 'Fertilisation',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog) return []

    const months = parseMonthsCsv(catalog.fertilizerMonths)
    const currentMonth = currentDate.getMonth() + 1
    if (!months.includes(currentMonth)) return []

    if (daysSince(instance.lastFertilizedAt, currentDate) < 28) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'fertilisation',
        label: `Fertilise ${plantName} ce mois-ci 🌿`,
        shortLabel: 'Fertiliser',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: currentDate.toISOString().slice(0, 10),
        done: false,
        priority: 'medium',
      },
    ]
  },
}
