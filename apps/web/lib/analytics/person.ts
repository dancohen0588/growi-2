/**
 * Propriétés de personne qui demandent une lecture en base.
 *
 * `gardens_count` et `plants_count` sont l'état du compte, pas des
 * événements : on les **recompte** plutôt que de les incrémenter. Un compteur
 * incrémenté dérive au premier ajout raté, à la première suppression en
 * cascade, au premier import — et personne ne s'en aperçoit avant de lire un
 * tableau de bord faux.
 *
 * Comme tout le reste de l'observabilité : **rien ne lève, rien ne s'attend**.
 */

import { setPersonProperties } from '@/lib/analytics/server'
import { prisma } from '@/lib/prisma'

/** Recompte jardins et plantes, puis met à jour le profil PostHog. */
export function refreshGardenCounts(userId: string): void {
  void (async () => {
    const [gardens, plants] = await Promise.all([
      prisma.garden.count({ where: { userId } }),
      prisma.plantInstance.count({ where: { userId } }),
    ])
    setPersonProperties(userId, { gardens_count: gardens, plants_count: plants })
  })().catch((error) => {
    console.error('[analytics] recomptage impossible', error)
  })
}

/** Nombre de plantes du compte, pour la propriété `plants_total` d'un événement. */
export async function countPlants(userId: string): Promise<number> {
  return prisma.plantInstance.count({ where: { userId } })
}
