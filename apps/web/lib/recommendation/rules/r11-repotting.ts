import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { parseJsonArray, getCurrentSeason, daysSince, seasonWindow } from '../utils'

export const r11Repotting: AdviceRule = {
  id: 'r11-repotting',
  name: 'Rempotage',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog) return []

    // Only for potted plants
    if (instance.containerSizeLiters == null) return []

    // Rempoter, c'est casser la motte : on ne l'inflige pas à une plante qui
    // ne va déjà pas bien. Elle a besoin d'être soignée d'abord.
    if (instance.healthStatus !== 'HEALTHY') return []

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

    // Un rempotage se fait dans la saison, pas ce mardi.
    const window = seasonWindow(currentDate)

    const last = instance.lastRepottedAt
      ? `Dernier rempotage il y a environ ${Math.floor(daysSince(instance.lastRepottedAt, currentDate) / 30)} mois.`
      : 'Aucun rempotage noté depuis son ajout.'

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'rempotage',
        label: `Rempotage recommandé pour ${plantName} 🪴`,
        shortLabel: 'Rempoter',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: window.end,
        done: false,
        priority: 'low',
        kind: 'window',
        window,
        ruleId: this.id,
        why: `C'est la saison de rempotage de cette plante. ${last} À faire quand tu as le temps, d'ici la fin de la saison.`,
        howTo: catalog.careTipSoil ?? undefined,
      },
    ]
  },
}
