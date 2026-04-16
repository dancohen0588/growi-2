import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { parseJsonArray, getCurrentSeason, daysSince } from '../utils'

export const r11Repotting: AdviceRule = {
  id: 'r11-repotting',
  name: 'Rempotage',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog) return []

    // Only for potted plants
    if (instance.containerSizeLiters == null) return []

    const seasons = parseJsonArray(catalog.repottingSeasons).length > 0
      ? parseJsonArray(catalog.repottingSeasons)
      : null

    // repottingSeasons stores strings like ["SPRING","AUTUMN"] — parse as string array
    let seasonStrings: string[] = []
    if (catalog.repottingSeasons) {
      try {
        const parsed = JSON.parse(catalog.repottingSeasons)
        if (Array.isArray(parsed)) seasonStrings = parsed
      } catch { /* ignore */ }
    }

    const currentSeason = getCurrentSeason(currentDate.getMonth() + 1)
    if (seasonStrings.length > 0 && !seasonStrings.includes(currentSeason)) return []

    // Check repotting frequency
    const freqDays = (catalog.repottingFreqMonths ?? 12) * 30
    if (daysSince(instance.lastRepottedAt, currentDate) < freqDays) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'rempotage',
        label: `Rempotage recommandé pour ${plantName} 🪴`,
        shortLabel: 'Rempoter',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: currentDate.toISOString().slice(0, 10),
        done: false,
        priority: 'low',
      },
    ]
  },
}
