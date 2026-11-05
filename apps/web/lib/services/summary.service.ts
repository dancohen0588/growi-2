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
  pickDailyIndex,
  type DashboardSummary,
  type HealthStatus,
  type HeroPhoto,
} from '@growi/shared'

import { prisma } from '@/lib/prisma'
import { getTodayPlanning } from '@/lib/services/planning.service'

export type { DashboardSummary, HeroPhoto }

/**
 * Plafond de candidates lues pour la photo du jour. Au-delà, le tirage porte
 * sur les plus récentes : c'est un habillage, pas une rétrospective, et une
 * lecture bornée reste rapide quel que soit le jardin.
 */
const HERO_CANDIDATES_MAX = 200

/**
 * La photo du haut de l'accueil, parmi les plantes dont l'utilisateur a pris
 * lui-même la photo. Jamais la photo du catalogue : elle n'est pas « à lui »,
 * et sa qualité varie trop pour tenir un plein écran.
 *
 * Le tirage dépend du compte et du jour (`day`, dans le fuseau de
 * l'utilisateur) : stable sur la journée, différent le lendemain.
 */
export async function getHeroPhoto(userId: string, day: string): Promise<HeroPhoto | null> {
  const candidates = await prisma.plantInstance.findMany({
    where: { userId, photoUrl: { not: null } },
    select: {
      id: true,
      customName: true,
      photoUrl: true,
      catalogPlant: { select: { commonName: true } },
      garden: { select: { name: true } },
    },
    // Un ordre fixe : sans lui, le même indice désignerait une autre plante
    // d'une requête à l'autre et le tirage « du jour » ne tiendrait pas.
    orderBy: [{ dateAdded: 'desc' }, { id: 'asc' }],
    take: HERO_CANDIDATES_MAX,
  })

  const index = pickDailyIndex(`${userId}:${day}`, candidates.length)
  const plant = candidates[index]
  if (!plant?.photoUrl) return null

  return {
    plantId: plant.id,
    plantName: plant.customName?.trim() || plant.catalogPlant?.commonName || 'Ta plante',
    gardenName: plant.garden?.name ?? null,
    photoUrl: plant.photoUrl,
  }
}

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

  // Les secrets ont leur propre carte : les compter ici ferait annoncer sur
  // l'Accueil plus de tâches que le planning n'en montre.
  const actions = planning.gardens.flatMap((garden) => garden.actions).filter((a) => !a.secret)
  const alerts = planning.gardens.flatMap((garden) => garden.alerts)

  // L'horizon se lit sur l'action entière : une action à fenêtre en cours va
  // dans « ce mois-ci », elle n'a rien à faire dans le compte du jour.
  const today = actions.filter((a) => actionHorizon(a, planning.date) === 'today')
  const weekEnd = addDays(planning.date, 7)

  // Après le planning : c'est lui qui connaît le jour dans le fuseau de
  // l'utilisateur. Une photo qu'on n'a pas pu lire n'empêche pas l'accueil.
  const heroPhoto = plants > 0 ? await getHeroPhoto(userId, planning.date).catch(() => null) : null

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
    heroPhoto,
  }
}
