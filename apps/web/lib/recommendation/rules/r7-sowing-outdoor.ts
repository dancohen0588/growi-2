import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { monthRunWindow, parseJsonArray } from '../utils'

export const r7SowingOutdoor: AdviceRule = {
  id: 'r7-sowing-outdoor',
  name: 'Semis en plein air',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, weather, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog) return []

    const months = parseJsonArray(catalog.sowingMonthsOutdoor)
    const currentMonth = currentDate.getMonth() + 1
    if (!months.includes(currentMonth)) return []

    // Check 3 consecutive days with tempMin > 10°C
    const warmDays = weather.daily.slice(0, 3)
    if (warmDays.length < 3 || warmDays.some((d) => d.tempMin <= 10)) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''

    // La météo dit que c'est possible maintenant ; le calendrier dit jusqu'à
    // quand. L'action reste donc une fenêtre, pas une urgence du jour.
    const window = monthRunWindow(months, currentDate)

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'semis',
        label: `Semis direct possible — plante ${plantName} dehors 🌱`,
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
        why: `C'est la période de semis en pleine terre, et les trois prochaines nuits restent au-dessus de 10 °C (minimum prévu : ${Math.round(Math.min(...warmDays.map((d) => d.tempMin)))} °C).`,
      },
    ]
  },
}
