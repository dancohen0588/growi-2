import { z } from 'zod'

/**
 * Contrat de `GET /api/v1/summary` — les indicateurs de l'accueil.
 *
 * Des nombres, et rien d'autre : la couleur qui les accompagne se déduit ici
 * même (`indicatorTone`), pour que le web et le mobile teintent la même
 * situation de la même façon.
 */

export const dashboardSummarySchema = z.object({
  gardens: z.number().int(),
  plants: z.number().int(),
  /** Plantes dont l'arrosage est dû aujourd'hui ou en retard. */
  plantsToWater: z.number().int(),
  /** Gestes dus aujourd'hui, retard compris. */
  tasksToday: z.number().int(),
  /** Part de ces gestes qui est en retard. */
  tasksLate: z.number().int(),
  /** Gestes à venir dans les sept jours, celui-ci non compris. */
  tasksWeek: z.number().int(),
  alerts: z.number().int(),
  /** Alertes de gravité haute — gel, canicule. */
  alertsHigh: z.number().int(),
  plantsWarning: z.number().int(),
  plantsCritical: z.number().int(),
})

export type DashboardSummary = z.infer<typeof dashboardSummarySchema>

// ─── Couleur des indicateurs ───────────────────────────────────────────────

/**
 * Ce que dit la couleur d'un indicateur.
 *
 * `neutral` pour un compteur qui n'appelle aucune action — le nombre de
 * plantes n'est ni bon ni mauvais.
 */
export const INDICATOR_TONES = ['neutral', 'good', 'warning', 'critical'] as const
export type IndicatorTone = (typeof INDICATOR_TONES)[number]

export type IndicatorKind = 'plants' | 'tasks' | 'water' | 'alerts' | 'health'

/**
 * La couleur d'un indicateur, à partir des seuls compteurs.
 *
 * Le rouge est réservé à ce qui se dégrade — du retard, une alerte grave, une
 * plante en danger. Ce qui reste à faire aujourd'hui est ambre : c'est normal,
 * pas alarmant.
 */
export function indicatorTone(kind: IndicatorKind, summary: DashboardSummary): IndicatorTone {
  switch (kind) {
    case 'plants':
      return summary.plants === 0 ? 'neutral' : 'good'

    case 'tasks':
      if (summary.tasksLate > 0) return 'critical'
      if (summary.tasksToday > 0) return 'warning'
      return 'good'

    // L'arrosage du jour est attendu, pas alarmant : il ne passe pas au rouge
    // sous prétexte qu'une taille traîne depuis trois semaines.
    case 'water':
      return summary.plantsToWater > 0 ? 'warning' : 'good'

    case 'alerts':
      if (summary.alertsHigh > 0) return 'critical'
      if (summary.alerts > 0) return 'warning'
      return 'good'

    case 'health':
      if (summary.plantsCritical > 0) return 'critical'
      if (summary.plantsWarning > 0) return 'warning'
      return summary.plants === 0 ? 'neutral' : 'good'
  }
}
