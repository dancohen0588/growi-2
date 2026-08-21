/**
 * Service des indicateurs de l'accueil.
 *
 * Les compteurs viennent de deux sources : la base pour ce qui se compte
 * (jardins, plantes, états de santé), le planning pour ce qui se déduit
 * (gestes dus, alertes). Passer par le planning plutôt que de recompter à
 * part garantit que l'accueil et le calendrier annoncent le même nombre.
 */

import {
  actionHorizon,
  addDays,
  type DashboardSummary,
  type HealthStatus,
} from '@growi/shared'

import { prisma } from '@/lib/prisma'
import { getTodayPlanning } from '@/lib/services/planning.service'

export type { DashboardSummary }

export async function getDashboardSummary(
  userId: string,
  now = new Date(),
): Promise<DashboardSummary> {
  const [gardens, plants, byHealth, planning] = await Promise.all([
    prisma.garden.count({ where: { userId } }),
    prisma.plantInstance.count({ where: { userId } }),
    prisma.plantInstance.groupBy({
      by: ['healthStatus'],
      where: { userId },
      _count: { _all: true },
    }),
    getTodayPlanning(userId, now),
  ])

  const health = (status: HealthStatus) =>
    byHealth.find((row) => row.healthStatus === status)?._count._all ?? 0

  const actions = planning.gardens.flatMap((garden) => garden.actions)
  const alerts = planning.gardens.flatMap((garden) => garden.alerts)

  const today = actions.filter((a) => actionHorizon(a.dueDate, planning.date) === 'today')
  const weekEnd = addDays(planning.date, 7)

  return {
    gardens,
    plants,
    plantsToWater: today.filter((a) => a.type === 'arrosage').length,
    tasksToday: today.length,
    tasksLate: today.filter((a) => a.dueDate < planning.date).length,
    // À venir dans la semaine : ce qui n'est pas déjà dû aujourd'hui.
    tasksWeek: actions.filter((a) => a.dueDate > planning.date && a.dueDate <= weekEnd).length,
    alerts: alerts.length,
    alertsHigh: alerts.filter((a) => a.severity === 'high').length,
    plantsWarning: health('WARNING'),
    plantsCritical: health('CRITICAL'),
  }
}
