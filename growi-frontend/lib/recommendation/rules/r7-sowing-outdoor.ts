import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { isMonthIn } from '../utils'

export const r7SowingOutdoor: AdviceRule = {
  id: 'r7-sowing-outdoor',
  name: 'Semis en plein air',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, weather, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog) return []

    const currentMonth = currentDate.getMonth() + 1
    if (!isMonthIn(currentMonth, catalog.sowingMonthsOutdoor)) return []

    // Check 3 consecutive days with tempMin > 10°C
    const warmDays = weather.daily.slice(0, 3)
    if (warmDays.length < 3 || warmDays.some((d) => d.tempMin <= 10)) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'semis',
        label: `Semis direct possible — plante ${plantName} dehors 🌱`,
        shortLabel: 'Semer',
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
