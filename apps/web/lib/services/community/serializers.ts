import { DEFAULT_COMMUNITY_RADIUS_KM, type CommunityUser } from '@growi/shared'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

import { distanceLabelBetween } from './geo'

/**
 * Mise en forme des comptes pour la communauté — la **barrière** aux champs
 * privés.
 *
 * Dans son propre module, et pas dans `profile.service` : les trois services
 * de la communauté en ont besoin, et le faire porter par l'un d'eux créerait
 * un cycle d'imports dès que les notifications sont écrites depuis le suivi.
 */

/**
 * Les seules colonnes de `users` que la communauté a le droit de lire.
 *
 * `email`, `name`, `firstName`, `lastName`, `address`, `latitude`, `longitude`
 * n'y sont pas — et ne doivent pas y entrer. Sélectionner large « au cas où »
 * est la façon habituelle dont une donnée privée finit dans une réponse.
 */
export const COMMUNITY_USER_SELECT = {
  id: true,
  handle: true,
  bio: true,
  image: true,
  avatarColor: true,
  locationCity: true,
  fuzzyLat: true,
  fuzzyLng: true,
  followerCount: true,
  followingCount: true,
  postCount: true,
  communityEnabled: true,
  communityEnabledAt: true,
  disabledAt: true,
  createdAt: true,
} satisfies Prisma.UserSelect

export type CommunityUserRow = Prisma.UserGetPayload<{ select: typeof COMMUNITY_USER_SELECT }>

/** Position du lecteur, pour calculer les distances affichées. */
export type Viewer = { fuzzyLat: number | null; fuzzyLng: number | null } | null

/**
 * Ligne Prisma → utilisateur tel que la communauté l'expose.
 *
 * **Construit champ par champ, jamais par recopie de la ligne.** C'est la même
 * discipline que les sérialiseurs de l'admin, et pour la même raison : une
 * colonne ajoutée demain à `User` ne doit pas pouvoir apparaître à l'écran
 * toute seule.
 */
export function toCommunityUser(row: CommunityUserRow, viewer: Viewer): CommunityUser {
  return {
    id: row.id,
    // Un compte sans pseudo n'est jamais servi par la communauté ; la valeur de
    // repli ne sert qu'à satisfaire le type.
    handle: row.handle ?? '',
    avatarUrl: row.image,
    avatarColor: row.avatarColor,
    city: row.locationCity,
    distanceLabel: distanceLabelBetween(viewer, row),
  }
}

/** Position floutée du lecteur — `null` s'il est anonyme. */
export async function findViewer(viewerId: string | null): Promise<Viewer> {
  if (!viewerId) return null
  return prisma.user.findUnique({
    where: { id: viewerId },
    select: { fuzzyLat: true, fuzzyLng: true },
  })
}

/**
 * La colonne accepte n'importe quel entier ; le contrat n'expose que trois
 * paliers. Une valeur inattendue en base retombe sur le défaut plutôt que de
 * faire échouer la lecture d'un profil.
 */
export function normalizeRadius(km: number): 5 | 20 | 50 {
  return km === 5 || km === 20 || km === 50 ? km : DEFAULT_COMMUNITY_RADIUS_KM
}
