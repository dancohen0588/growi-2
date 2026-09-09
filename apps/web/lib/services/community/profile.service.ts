import {
  COMMUNITY_RATE_LIMITS,
  RESERVED_HANDLES,
  handleSchema,
  type BlockResult,
  type BlockedAccount,
  type CommunityProfile,
  type CommunitySettings,
  type CommunityUserPage,
  type FollowResult,
  type HandleAvailability,
  type UpdateCommunitySettingsInput,
} from '@growi/shared'
import { Prisma } from '@prisma/client'

import { setPersonProperties, trackServer } from '@/lib/analytics/server'
import { prisma } from '@/lib/prisma'
import { ServiceError } from '@/lib/services/errors'

import { decodeCursor, takePage } from './cursor'
import { fuzzyPosition } from './geo'
import { assertClean } from './moderation.service'
import { notifyFollow } from './notification.service'
import {
  COMMUNITY_USER_SELECT,
  findViewer,
  normalizeRadius,
  toCommunityUser,
  type CommunityUserRow,
} from './serializers'

/**
 * Identité publique, abonnements et blocage.
 *
 * Comme partout dans `lib/services`, aucune fonction ne lit la session : le
 * `userId` de l'appelant est un paramètre, et celui de la cible est retrouvé
 * par son pseudo.
 */

/** Profils par page des listes d'abonnés et d'abonnements. */
const FOLLOWS_PAGE_SIZE = 30

// ─── Mes réglages ──────────────────────────────────────────────────────────

const SETTINGS_SELECT = {
  handle: true,
  bio: true,
  communityEnabled: true,
  communityEnabledAt: true,
  communityRadiusKm: true,
  followerCount: true,
  followingCount: true,
  postCount: true,
  locationCity: true,
  latitude: true,
  longitude: true,
} satisfies Prisma.UserSelect

type SettingsRow = Prisma.UserGetPayload<{ select: typeof SETTINGS_SELECT }>

function toSettings(row: SettingsRow): CommunitySettings {
  return {
    enabled: row.communityEnabled,
    enabledAt: row.communityEnabledAt?.toISOString() ?? null,
    handle: row.handle,
    bio: row.bio,
    radiusKm: normalizeRadius(row.communityRadiusKm),
    followerCount: row.followerCount,
    followingCount: row.followingCount,
    postCount: row.postCount,
    hasLocation: row.latitude !== null && row.longitude !== null,
    city: row.locationCity,
  }
}

/** @throws ServiceError('NOT_FOUND') si le compte n'existe plus. */
export async function getSettings(userId: string): Promise<CommunitySettings> {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: SETTINGS_SELECT })
  if (!row) throw new ServiceError('NOT_FOUND', 'Utilisateur introuvable')
  return toSettings(row)
}

/**
 * Active, modifie ou désactive le profil public.
 *
 * Un seul point d'entrée pour les trois : l'écran d'activation poste un pseudo
 * et `enabled: true`, les réglages postent un rayon. En faire deux routes
 * aurait dupliqué les mêmes vérifications.
 *
 * @throws ServiceError('INVALID_INPUT') si l'activation est demandée sans
 * pseudo ou sans position, ServiceError('CONFLICT') si le pseudo est pris.
 */
export async function updateSettings(
  userId: string,
  input: UpdateCommunitySettingsInput,
): Promise<CommunitySettings> {
  const current = await prisma.user.findUnique({ where: { id: userId }, select: SETTINGS_SELECT })
  if (!current) throw new ServiceError('NOT_FOUND', 'Utilisateur introuvable')

  const handle = input.handle ?? current.handle
  const enabling = input.enabled === true && !current.communityEnabled

  if (input.enabled === true) {
    if (!handle) {
      throw new ServiceError('INVALID_INPUT', 'Choisis un pseudo avant d’activer ton profil.')
    }
    // Sans position, il n'y a ni fil local ni distance : le profil serait
    // activé et invisible. L'écran demande donc la ville avant d'en arriver là.
    if (current.latitude === null || current.longitude === null) {
      throw new ServiceError(
        'INVALID_INPUT',
        'Indique d’abord la ville de ton jardin pour rejoindre la communauté.',
      )
    }
  }

  assertClean(input.handle, input.bio)

  const data: Prisma.UserUpdateInput = {}

  if (input.handle !== undefined) data.handle = input.handle
  if (input.bio !== undefined) data.bio = input.bio || null
  if (input.radiusKm !== undefined) data.communityRadiusKm = input.radiusKm

  if (input.enabled !== undefined) {
    data.communityEnabled = input.enabled
    // La date du premier oui, conservée telle quelle : réactiver n'est pas
    // rejoindre à nouveau.
    if (enabling && !current.communityEnabledAt) data.communityEnabledAt = new Date()
  }

  // La position floutée est (re)calculée à l'activation. Elle l'est aussi à
  // chaque changement d'adresse, depuis `user.service.updateProfile`.
  if (input.enabled === true && current.latitude !== null && current.longitude !== null) {
    Object.assign(data, fuzzyPosition(userId, current.latitude, current.longitude))
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: SETTINGS_SELECT,
    })

    // Le premier oui seulement : réactiver un profil mis en pause n'est pas
    // rejoindre la communauté, et le compter ferait enfler la courbe des
    // arrivées avec des allers-retours.
    if (enabling) {
      trackServer(userId, 'community_activated', {})
      setPersonProperties(userId, { community_activated: true })
    }

    return toSettings(updated)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ServiceError('CONFLICT', 'Ce pseudo est déjà pris.')
    }
    throw err
  }
}

/**
 * Recalcule la position floutée d'un compte qui a déménagé.
 *
 * Appelée depuis `user.service.updateProfile` : une position floutée restée
 * sur l'ancienne commune serait pire qu'absente. Ne fait rien si le compte
 * n'est pas dans la communauté — il n'y a alors rien à flouter.
 */
export async function refreshFuzzyPosition(
  userId: string,
  latitude: number | null,
  longitude: number | null,
): Promise<void> {
  const data =
    latitude === null || longitude === null
      ? { fuzzyLat: null, fuzzyLng: null }
      : fuzzyPosition(userId, latitude, longitude)

  await prisma.user.update({ where: { id: userId }, data })
}

/**
 * Disponibilité d'un pseudo, telle qu'affichée sous le champ de saisie.
 *
 * Répond « disponible » pour son propre pseudo : sur l'écran de modification,
 * ne pas changer de pseudo ne doit pas s'afficher comme un conflit.
 */
export async function checkHandle(
  handle: string,
  userId: string | null,
): Promise<HandleAvailability> {
  const parsed = handleSchema.safeParse(handle)
  if (!parsed.success) {
    return {
      handle: handle.trim().toLowerCase(),
      available: false,
      reason: parsed.error.issues[0]?.message ?? 'Pseudo invalide',
    }
  }

  const value = parsed.data
  const owner = await prisma.user.findUnique({ where: { handle: value }, select: { id: true } })

  if (owner && owner.id !== userId) {
    return { handle: value, available: false, reason: 'Ce pseudo est déjà pris' }
  }

  return { handle: value, available: true, reason: null }
}

// ─── Lecture d'un profil public ────────────────────────────────────────────

/**
 * Retrouve un compte par son pseudo, tel qu'il est visible par `viewerId`.
 *
 * Trois raisons de répondre « introuvable » plutôt que d'expliquer : profil
 * non activé, compte désactivé par un administrateur, et **compte qui a bloqué
 * le lecteur**. Dans ce dernier cas, distinguer « ce compte t'a bloqué » de
 * « ce compte n'existe pas » confirmerait justement l'existence du compte à
 * celui dont on veut se protéger.
 *
 * @throws ServiceError('NOT_FOUND')
 */
async function findVisibleByHandle(
  handle: string,
  viewerId: string | null,
): Promise<CommunityUserRow> {
  const row = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: COMMUNITY_USER_SELECT,
  })

  if (!row || !row.communityEnabled || row.disabledAt) {
    throw new ServiceError('NOT_FOUND', 'Ce profil est introuvable.')
  }

  if (viewerId && viewerId !== row.id) {
    const blockedMe = await prisma.block.findUnique({
      where: { blockerId_blockedId: { blockerId: row.id, blockedId: viewerId } },
      select: { blockerId: true },
    })
    if (blockedMe) throw new ServiceError('NOT_FOUND', 'Ce profil est introuvable.')
  }

  return row
}

/** @throws ServiceError('NOT_FOUND') si le profil n'est pas visible par ce lecteur. */
export async function getProfileByHandle(
  handle: string,
  viewerId: string | null,
): Promise<CommunityProfile> {
  const row = await findVisibleByHandle(handle, viewerId)
  const isSelf = viewerId === row.id

  const [viewer, following, blocked] = await Promise.all([
    isSelf ? Promise.resolve(null) : findViewer(viewerId),
    viewerId && !isSelf
      ? prisma.follow.findUnique({
          where: { followerId_followingId: { followerId: viewerId, followingId: row.id } },
          select: { followerId: true },
        })
      : Promise.resolve(null),
    viewerId && !isSelf
      ? prisma.block.findUnique({
          where: { blockerId_blockedId: { blockerId: viewerId, blockedId: row.id } },
          select: { blockerId: true },
        })
      : Promise.resolve(null),
  ])

  return {
    ...toCommunityUser(row, viewer),
    bio: row.bio,
    followerCount: row.followerCount,
    followingCount: row.followingCount,
    postCount: row.postCount,
    isSelf,
    // `null` et non `false` pour un lecteur anonyme : il n'y a personne pour
    // suivre, ce qui n'est pas la même chose que « ne suit pas ».
    isFollowing: viewerId && !isSelf ? Boolean(following) : null,
    isBlocked: viewerId && !isSelf ? Boolean(blocked) : null,
    memberSince: (row.communityEnabledAt ?? row.createdAt).toISOString(),
  }
}

// ─── Abonnements ───────────────────────────────────────────────────────────

/**
 * Nombre d'abonnements pris dans les dernières 24 heures.
 *
 * Fenêtre glissante et non « jour calendaire » : ce plafond est un garde-fou
 * anti-spam, pas un quota que l'utilisateur consulte. Il n'a donc pas besoin
 * d'une heure de remise à zéro lisible, et s'évite du même coup la question du
 * fuseau horaire.
 */
async function assertFollowBudget(userId: string): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const count = await prisma.follow.count({
    where: { followerId: userId, createdAt: { gte: since } },
  })

  if (count >= COMMUNITY_RATE_LIMITS.followsPerDay) {
    throw new ServiceError(
      'RATE_LIMITED',
      'Tu as suivi beaucoup de monde aujourd’hui — reprends demain.',
    )
  }
}

/**
 * Suivre un compte. **Idempotent** : suivre deux fois n'ajoute rien et ne lève
 * pas — un double tap ne doit pas produire une erreur rouge.
 *
 * @throws ServiceError('INVALID_INPUT') si l'on tente de se suivre soi-même,
 * ServiceError('FORBIDDEN') si l'un des deux comptes a bloqué l'autre.
 */
export async function follow(userId: string, handle: string): Promise<FollowResult> {
  const target = await findVisibleByHandle(handle, userId)

  if (target.id === userId) {
    throw new ServiceError('INVALID_INPUT', 'On ne se suit pas soi-même.')
  }

  // `findVisibleByHandle` a déjà écarté le cas « il m'a bloqué » (en 404) ;
  // reste le mien, qui se dit franchement.
  const iBlocked = await prisma.block.findUnique({
    where: { blockerId_blockedId: { blockerId: userId, blockedId: target.id } },
    select: { blockerId: true },
  })
  if (iBlocked) {
    throw new ServiceError('FORBIDDEN', 'Débloque ce compte avant de le suivre.')
  }

  await assertFollowBudget(userId)

  const result = await prisma.$transaction(async (tx) => {
    // `skipDuplicates` fait l'unicité et l'idempotence en une requête : deux
    // taps simultanés n'incrémentent pas deux fois.
    const inserted = await tx.follow.createMany({
      data: { followerId: userId, followingId: target.id },
      skipDuplicates: true,
    })

    if (inserted.count === 0) return { followerCount: target.followerCount, created: false }

    await tx.user.update({
      where: { id: userId },
      data: { followingCount: { increment: 1 } },
    })
    const updated = await tx.user.update({
      where: { id: target.id },
      data: { followerCount: { increment: 1 } },
      select: { followerCount: true },
    })
    return { followerCount: updated.followerCount, created: true }
  })

  // Même garde-fou que pour la notification : seul un abonnement réellement
  // créé compte.
  if (result.created) trackServer(userId, 'user_followed', {})

  // **Seulement quand l'abonnement vient d'être créé.** Sans ce garde-fou, un
  // double tap — ou un désabonnement suivi d'un réabonnement — préviendrait la
  // même personne autant de fois, ce qui est précisément la forme la plus
  // pénible de notification.
  //
  // Sans `await` : une notification est un agrément, pas une raison de faire
  // attendre le bouton « Suivre ». `notifyFollow` n'échoue jamais, elle
  // journalise.
  if (result.created) {
    const me = await prisma.user.findUnique({ where: { id: userId }, select: { handle: true } })
    void notifyFollow({ id: userId, handle: me?.handle ?? null }, target.id)
  }

  return { isFollowing: true, followerCount: result.followerCount }
}

/** Ne plus suivre. Idempotent, pour la même raison que `follow`. */
export async function unfollow(userId: string, handle: string): Promise<FollowResult> {
  const target = await findVisibleByHandle(handle, userId)

  const followerCount = await prisma.$transaction(async (tx) => {
    const removed = await tx.follow.deleteMany({
      where: { followerId: userId, followingId: target.id },
    })

    if (removed.count === 0) return target.followerCount

    await tx.user.update({
      where: { id: userId },
      data: { followingCount: { decrement: 1 } },
    })
    const updated = await tx.user.update({
      where: { id: target.id },
      data: { followerCount: { decrement: 1 } },
      select: { followerCount: true },
    })
    return updated.followerCount
  })

  return { isFollowing: false, followerCount }
}

/**
 * Les abonnés d'un compte, ou ses abonnements.
 *
 * Une seule fonction pour les deux listes : elles ne diffèrent que par la
 * colonne de `follows` qu'on fixe et par celle qu'on lit. Les comptes sortis
 * de la communauté, désactivés ou en blocage avec le lecteur en sont écartés —
 * une liste d'abonnés est une porte vers des profils, et elle ne doit pas
 * mener sur des 404.
 *
 * @throws ServiceError('NOT_FOUND') si le profil n'est pas visible par ce lecteur.
 */
export async function listFollows(
  handle: string,
  viewerId: string | null,
  direction: 'followers' | 'following',
  rawCursor: string | null,
): Promise<CommunityUserPage> {
  const target = await findVisibleByHandle(handle, viewerId)
  const cursor = decodeCursor(rawCursor)
  const hidden = await hiddenUserIds(viewerId)

  // « Ses abonnés » fixe `followingId` et lit `follower` ; « ses abonnements »
  // l'inverse.
  const fixed = direction === 'followers' ? 'followingId' : 'followerId'
  const read = direction === 'followers' ? 'followerId' : 'followingId'

  const rows = await prisma.follow.findMany({
    where: {
      [fixed]: target.id,
      ...(hidden.length > 0 ? { [read]: { notIn: hidden } } : {}),
      [direction === 'followers' ? 'follower' : 'following']: {
        disabledAt: null,
        communityEnabled: true,
      },
      ...(cursor ? { createdAt: { lt: cursor.createdAt } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: FOLLOWS_PAGE_SIZE + 1,
    include: {
      follower: { select: COMMUNITY_USER_SELECT },
      following: { select: COMMUNITY_USER_SELECT },
    },
  })

  // `follows` n'a pas d'`id` : la clé du curseur est la paire, et on prend
  // celui du compte lu — unique dans la liste, puisqu'on ne suit quelqu'un
  // qu'une fois.
  const withId = rows.map((row) => {
    const user = direction === 'followers' ? row.follower : row.following
    return { id: user.id, createdAt: row.createdAt, user }
  })

  const page = takePage(withId, FOLLOWS_PAGE_SIZE)
  const viewer = await findViewer(viewerId)

  return {
    items: page.items.map((row) => toCommunityUser(row.user, viewer)),
    nextCursor: page.nextCursor,
  }
}

/** Les comptes que suit `userId` — la base du fil « Abonnements ». */
export async function followingIds(userId: string): Promise<string[]> {
  const rows = await prisma.follow.findMany({
    where: { followerId: userId },
    select: { followingId: true },
  })
  return rows.map((row) => row.followingId)
}

// ─── Blocage ───────────────────────────────────────────────────────────────

/**
 * Bloquer un compte.
 *
 * Le blocage **rompt les abonnements dans les deux sens**, dans la même
 * transaction que sa création : rester abonné à quelqu'un dont on ne verra
 * plus rien laisserait un compteur qui ment et une ligne dans « Abonnements »
 * qui ne mène nulle part. Débloquer ne les rétablit pas — c'est délibéré.
 *
 * Contrairement à `findVisibleByHandle`, on accepte de bloquer un compte
 * désactivé ou qui a quitté la communauté : se protéger ne doit pas dépendre
 * de l'état du compte d'en face.
 *
 * @throws ServiceError('NOT_FOUND') si le pseudo n'existe pas,
 * ServiceError('INVALID_INPUT') si l'on tente de se bloquer soi-même.
 */
export async function block(userId: string, handle: string): Promise<BlockResult> {
  const target = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: { id: true },
  })
  if (!target) throw new ServiceError('NOT_FOUND', 'Ce profil est introuvable.')

  if (target.id === userId) {
    throw new ServiceError('INVALID_INPUT', 'On ne se bloque pas soi-même.')
  }

  await prisma.$transaction(async (tx) => {
    await tx.block.createMany({
      data: { blockerId: userId, blockedId: target.id },
      skipDuplicates: true,
    })

    const [mine, theirs] = await Promise.all([
      tx.follow.deleteMany({ where: { followerId: userId, followingId: target.id } }),
      tx.follow.deleteMany({ where: { followerId: target.id, followingId: userId } }),
    ])

    if (mine.count === 0 && theirs.count === 0) return

    await tx.user.update({
      where: { id: userId },
      data: {
        followingCount: { decrement: mine.count },
        followerCount: { decrement: theirs.count },
      },
    })
    await tx.user.update({
      where: { id: target.id },
      data: {
        followerCount: { decrement: mine.count },
        followingCount: { decrement: theirs.count },
      },
    })
  })

  // À surveiller de près pendant la F&F : c'est là que les problèmes humains
  // apparaissent avant d'arriver en signalement.
  trackServer(userId, 'user_blocked', {})

  return { isBlocked: true }
}

/** Débloquer. Ne rétablit aucun abonnement. */
export async function unblock(userId: string, handle: string): Promise<BlockResult> {
  const target = await prisma.user.findUnique({
    where: { handle: handle.toLowerCase() },
    select: { id: true },
  })
  if (!target) throw new ServiceError('NOT_FOUND', 'Ce profil est introuvable.')

  await prisma.block.deleteMany({ where: { blockerId: userId, blockedId: target.id } })

  return { isBlocked: false }
}

/** Les comptes bloqués, tels que listés dans les réglages. */
export async function listBlocked(userId: string): Promise<BlockedAccount[]> {
  const rows = await prisma.block.findMany({
    where: { blockerId: userId },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, blocked: { select: COMMUNITY_USER_SELECT } },
  })

  // Pas de distance ici : on ne calcule pas la proximité de quelqu'un dont on
  // vient de se protéger.
  return rows.map((row) => ({
    user: toCommunityUser(row.blocked, null),
    blockedAt: row.createdAt.toISOString(),
  }))
}

/**
 * Identifiants à écarter de toute lecture de `userId` — ceux qu'il a bloqués
 * **et** ceux qui l'ont bloqué.
 *
 * Une seule fonction pour les deux sens : n'en filtrer qu'un laisserait le
 * contenu du bloqueur visible par le bloqué, ce qui vide le blocage de son
 * sens. Les fils des phases suivantes s'en servent comme d'un `NOT IN`.
 */
export async function hiddenUserIds(userId: string | null): Promise<string[]> {
  if (!userId) return []

  const rows = await prisma.block.findMany({
    where: { OR: [{ blockerId: userId }, { blockedId: userId }] },
    select: { blockerId: true, blockedId: true },
  })

  const ids = new Set<string>()
  for (const row of rows) {
    ids.add(row.blockerId === userId ? row.blockedId : row.blockerId)
  }
  return [...ids]
}

/** Vrai si `handle` est réservé — exposé pour les tests et l'admin. */
export function isReservedHandle(handle: string): boolean {
  return (RESERVED_HANDLES as readonly string[]).includes(handle.toLowerCase())
}
