import type { AdviceRule, PlantContext, GardenAction, PlantAdvice, PlantAlert, GardenAdviceResult } from './types'
import { r1WateringStandard } from './rules/r1-watering-standard'
import { r2WateringHeat } from './rules/r2-watering-heat'
import { r3WateringRain } from './rules/r3-watering-rain'
import { r4PruningSeasonal } from './rules/r4-pruning-seasonal'
import { r5PruningOverdue } from './rules/r5-pruning-overdue'
import { r6SowingIndoor } from './rules/r6-sowing-indoor'
import { r7SowingOutdoor } from './rules/r7-sowing-outdoor'
import { r8Harvest } from './rules/r8-harvest'
import { r9Fertilizing } from './rules/r9-fertilizing'
import { r10FrostAlert } from './rules/r10-frost-alert'
import { r11Repotting } from './rules/r11-repotting'
import { r12PreventiveTreatment } from './rules/r12-preventive-treatment'

const PRIORITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 }
const MAX_ACTIONS_PER_PLANT = 5

export class RecommendationEngine {
  private rules: AdviceRule[] = [
    r1WateringStandard,
    r2WateringHeat,
    r3WateringRain,
    r4PruningSeasonal,
    r5PruningOverdue,
    r6SowingIndoor,
    r7SowingOutdoor,
    r8Harvest,
    r9Fertilizing,
    r10FrostAlert,
    r11Repotting,
    r12PreventiveTreatment,
  ]

  evaluate(contexts: PlantContext[]): GardenAction[] {
    const allActions: GardenAction[] = []

    for (const ctx of contexts) {
      const plantActions: GardenAction[] = []

      for (const rule of this.rules) {
        plantActions.push(...rule.evaluate(ctx))
      }

      // R5 overrides R4 for the same plant
      const hasR5 = plantActions.some((a) => a.id.startsWith('r5-'))
      const filtered = hasR5
        ? plantActions.filter((a) => !a.id.startsWith('r4-'))
        : plantActions

      // R3 overrides R1 for the same plant (rain postpones standard watering)
      const hasR3 = filtered.some((a) => a.id.startsWith('r3-'))
      const deduped = hasR3
        ? filtered.filter((a) => !a.id.startsWith('r1-'))
        : filtered

      // Deduplicate: same type + plantId + dueDate
      const seen = new Set<string>()
      const unique = deduped.filter((a) => {
        const key = `${a.type}:${a.plantId ?? ''}:${a.dueDate}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      // La photo est attachée ici plutôt que dans chacune des douze règles :
      // elle décrit la plante, pas le geste.
      const photoUrl = ctx.instance.photoUrl ?? ctx.instance.catalogPlant?.imageUrl ?? null

      // Cap per plant
      allActions.push(
        ...unique.slice(0, MAX_ACTIONS_PER_PLANT).map((a) => ({ ...a, plantPhotoUrl: photoUrl })),
      )
    }

    // Sort: priority (high→low) then dueDate (ascending)
    allActions.sort((a, b) => {
      const pDiff = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2)
      if (pDiff !== 0) return pDiff
      return a.dueDate.localeCompare(b.dueDate)
    })

    return allActions
  }

  generateAlerts(contexts: PlantContext[]): PlantAlert[] {
    const alerts: PlantAlert[] = []
    for (const ctx of contexts) {
      for (const rule of this.rules) {
        if (rule.generateAlerts) {
          alerts.push(...rule.generateAlerts(ctx))
        }
      }
    }
    return alerts
  }

  evaluateForPlant(ctx: PlantContext): PlantAdvice {
    const tasks = this.evaluate([ctx])
    const alerts = this.generateAlerts([ctx])
    const catalog = ctx.instance.catalogPlant

    return {
      plantInstanceId: ctx.instance.id,
      plantName: ctx.instance.customName ?? catalog?.commonName ?? 'Plante',
      plantEmoji: ctx.instance.emoji ?? catalog?.emoji ?? '',
      tasks,
      alerts,
      careTips: {
        watering: catalog?.careTipWatering ?? '',
        light: catalog?.careTipLight ?? '',
        soil: catalog?.careTipSoil ?? '',
        pruning: catalog?.careTipPruning ?? undefined,
        diseases: catalog?.careTipDiseases ?? undefined,
        winter: catalog?.careTipWinter ?? undefined,
      },
      generatedAt: ctx.currentDate,
    }
  }

  evaluateGarden(contexts: PlantContext[], gardenId: string): GardenAdviceResult {
    const now = contexts[0]?.currentDate ?? new Date()
    const actions = this.evaluate(contexts)
    const alerts = this.generateAlerts(contexts)
    const adviceByPlant = contexts.map((ctx) => this.evaluateForPlant(ctx))

    const expiresAt = new Date(now)
    expiresAt.setHours(expiresAt.getHours() + 6)

    return {
      gardenId,
      generatedAt: now,
      expiresAt,
      actions,
      adviceByPlant,
      alerts,
    }
  }
}
