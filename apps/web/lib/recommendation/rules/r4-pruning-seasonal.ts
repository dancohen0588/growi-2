import type { AdviceRule, PlantContext, GardenAction } from '../types'

const MS_PER_DAY = 86_400_000
const ELEVEN_MONTHS_DAYS = 335

/** Saison avec sa préposition, élision comprise : « d'été », et non « de été ». */
function getSeasonComplement(month: number): string {
  if (month >= 3 && month <= 5) return 'de printemps'
  if (month >= 6 && month <= 8) return "d'été"
  if (month >= 9 && month <= 11) return "d'automne"
  return "d'hiver"
}

function parsePruningMonths(raw: string | null | undefined): number[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const r4PruningSeasonal: AdviceRule = {
  id: 'r4-pruning-seasonal',
  name: 'Taille saisonnière',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog) return []

    const months = parsePruningMonths(catalog.pruningMonths)
    const currentMonth = currentDate.getMonth() + 1
    if (!months.includes(currentMonth)) return []

    // Skip if pruned less than 11 months ago
    if (instance.lastPrunedAt) {
      const daysSince = (currentDate.getTime() - new Date(instance.lastPrunedAt).getTime()) / MS_PER_DAY
      if (daysSince < ELEVEN_MONTHS_DAYS) return []
    }

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''
    const season = getSeasonComplement(currentMonth)

    const firstOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1)

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'taille',
        label: `Taille ${season} — ${plantName} ✂️`,
        shortLabel: 'Tailler',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: firstOfMonth.toISOString().slice(0, 10),
        done: false,
        priority: 'medium',
      },
    ]
  },
}
