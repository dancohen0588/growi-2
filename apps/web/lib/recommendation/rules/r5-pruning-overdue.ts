import type { AdviceRule, PlantContext, GardenAction } from '../types'
import { frenchDate, isoDay } from '../utils'

const MS_PER_DAY = 86_400_000
const THIRTEEN_MONTHS_DAYS = 395

function parsePruningMonths(raw: string | null | undefined): number[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export const r5PruningOverdue: AdviceRule = {
  id: 'r5-pruning-overdue',
  name: 'Taille en retard',

  evaluate(ctx: PlantContext): GardenAction[] {
    const { instance, currentDate } = ctx
    const catalog = instance.catalogPlant
    if (!catalog) return []

    const months = parsePruningMonths(catalog.pruningMonths)
    const currentMonth = currentDate.getMonth() + 1
    if (!months.includes(currentMonth)) return []

    if (!instance.lastPrunedAt) return []

    const daysSince = (currentDate.getTime() - new Date(instance.lastPrunedAt).getTime()) / MS_PER_DAY
    if (daysSince <= THIRTEEN_MONTHS_DAYS) return []

    const plantName = instance.customName ?? catalog.commonName ?? 'Plante'
    const emoji = instance.emoji ?? catalog.emoji ?? ''

    return [
      {
        id: `${this.id}:${instance.id}`,
        type: 'taille',
        label: `Taille urgente : ${plantName} n'a pas été taillé(e) depuis plus d'un an ✂️`,
        shortLabel: 'Tailler',
        plantId: instance.id,
        plantName,
        plantEmoji: emoji,
        dueDate: isoDay(currentDate),
        done: false,
        // Reste datée et prioritaire : treize mois sans taille, c'est un vrai
        // retard, pas une fenêtre qu'on prend à son rythme.
        priority: 'high',
        kind: 'dated',
        ruleId: this.id,
        why: `Dernière taille : ${frenchDate(instance.lastPrunedAt)}, soit plus de treize mois. On est dans la période de taille : c'est le moment de rattraper.`,
        howTo: catalog.careTipPruning ?? undefined,
      },
    ]
  },
}
