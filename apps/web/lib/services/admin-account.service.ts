/**
 * Actions d'administration sur un compte.
 *
 * Tout ce qui **écrit** sur le compte d'un tiers passe par ici, jamais depuis
 * une Server Action directement : c'est ce qui garantit que les invariants
 * métier (caches de conseils, jetons, cascades) sont tenus au même endroit, et
 * que chaque écriture est journalisée dans la transaction qui la porte.
 *
 * L'`userId` est toujours celui de la **cible** ; `actorId` celui de
 * l'administrateur. Les confondre serait la faute la plus coûteuse possible.
 */

import type { Prisma } from '@prisma/client'
import { Prisma as PrismaNS } from '@prisma/client'
import type { UpdateProfileInput } from '@growi/shared'

import { auditWrite, logAdminAction } from '@/lib/admin/audit'
import { prisma } from '@/lib/prisma'
import { invalidateGardenAdviceCache } from '@/lib/recommendation/garden-advice-service'
import { ServiceError } from '@/lib/services/errors'

// ─── Modification du profil ────────────────────────────────────────────────

/**
 * Champs qu'un administrateur peut modifier, au-delà de ceux du profil que
 * l'utilisateur édite lui-même.
 */
export type AdminProfilePatch = UpdateProfileInput & {
  name?: string | null
  plan?: string
  timezone?: string
  onboarded?: boolean
}

/** Colonnes réellement écrites — la liste blanche, en un seul endroit. */
const EDITABLE_COLUMNS = [
  'firstName',
  'lastName',
  'name',
  'email',
  'address',
  'locationCity',
  'gardenType',
  'avatarColor',
  'latitude',
  'longitude',
  'plan',
  'timezone',
  'onboarded',
] as const

type EditableColumn = (typeof EDITABLE_COLUMNS)[number]

/**
 * Traduit le patch en données Prisma, en ne retenant que la liste blanche.
 *
 * `city` est exposée sous ce nom mais stockée en `locationCity` : la même
 * traduction qu'opère `user.service.updateProfile`, à ne pas oublier ici.
 */
function toUpdateData(patch: AdminProfilePatch): Partial<Record<EditableColumn, unknown>> {
  const { city, ...rest } = patch
  const source: Record<string, unknown> = { ...rest }
  if (city !== undefined) source.locationCity = city

  const data: Partial<Record<EditableColumn, unknown>> = {}
  for (const column of EDITABLE_COLUMNS) {
    if (source[column] !== undefined) data[column] = source[column]
  }
  return data
}

/** Les valeurs d'avant, pour que le journal dise ce qui a changé. */
function pickBefore(
  before: Record<string, unknown>,
  data: Partial<Record<EditableColumn, unknown>>,
) {
  const snapshot: Record<string, unknown> = {}
  for (const column of Object.keys(data) as EditableColumn[]) {
    snapshot[column] = before[column] ?? null
  }
  return snapshot
}

/**
 * Met à jour le profil d'un compte.
 *
 * @throws ServiceError('NOT_FOUND') si le compte n'existe pas.
 * @throws ServiceError('INVALID_INPUT') si le patch ne touche aucun champ.
 * @throws ServiceError('CONFLICT') si l'email est déjà pris.
 */
export async function adminUpdateUserProfile(
  actorId: string,
  userId: string,
  patch: AdminProfilePatch,
) {
  const data = toUpdateData(patch)
  if (Object.keys(data).length === 0) {
    throw new ServiceError('INVALID_INPUT', 'Aucun champ à modifier.')
  }

  const before = await prisma.user.findUnique({ where: { id: userId } })
  if (!before) throw new ServiceError('NOT_FOUND', 'Utilisateur introuvable')

  let updated
  try {
    updated = await auditWrite(
      (tx) => tx.user.update({ where: { id: userId }, data: data as Prisma.UserUpdateInput }),
      {
        actorId,
        action: 'user.update',
        targetType: 'user',
        targetId: userId,
        // `data` ne contient que des colonnes de la liste blanche : aucun
        // secret ne peut s'y trouver, `assertNoSecrets` le revérifie.
        details: {
          avant: pickBefore(before as unknown as Record<string, unknown>, data),
          apres: data,
        } as Prisma.InputJsonValue,
      },
    )
  } catch (err) {
    if (err instanceof PrismaNS.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ServiceError('CONFLICT', 'Cet email est déjà utilisé.')
    }
    throw err
  }

  // Même règle que `user.service.updateProfile` : les conseils sont calculés
  // avec la météo du lieu. Déplacer un compte sans vider son cache lui
  // laisserait six heures de recommandations calées sur l'ancienne adresse.
  if (patch.latitude !== undefined || patch.longitude !== undefined) {
    await invalidateAllGardenCaches(userId)
  }

  return updated
}

// ─── Réinitialisation des recommandations ──────────────────────────────────

/**
 * Les trois niveaux, du plus anodin au plus destructeur.
 *
 * Le niveau 1 répond à 90 % des cas — « je ne vois pas mes tâches à jour » —
 * et ne perd rien. Les deux autres servent au support après un import raté ou
 * une série de tests.
 */
export const RESET_LEVELS = {
  1: 'Recalculer les conseils',
  2: 'Purger les tâches planifiées',
  3: "Remettre à zéro le suivi d'entretien",
} as const

export type ResetLevel = 1 | 2 | 3

export type ResetOutcome = {
  level: ResetLevel
  gardensInvalidated: number
  tasksDeleted: number
  plantsReset: number
}

/** Vide le cache de conseils de tous les jardins du compte. Le niveau 1. */
async function invalidateAllGardenCaches(userId: string): Promise<number> {
  const gardens = await prisma.garden.findMany({ where: { userId }, select: { id: true } })
  await Promise.all(gardens.map((garden) => invalidateGardenAdviceCache(garden.id)))
  return gardens.length
}

/**
 * Colonnes de suivi d'entretien portées par la plante.
 *
 * Ce sont des **dérivés** des `CareLog`, pas des faits : les remettre à zéro
 * n'efface aucun geste noté, seulement ce que le moteur en avait retenu.
 */
const CARE_TRACKING_COLUMNS = [
  'lastWateredAt',
  'lastFertilizedAt',
  'lastPrunedAt',
  'lastRepottedAt',
  'lastTreatedAt',
] as const

/**
 * Réinitialise les recommandations d'un compte, au niveau demandé.
 *
 * Les niveaux ne s'emboîtent pas : le 3 ne purge pas les tâches du 2. Chacun
 * fait son geste propre, **puis** le niveau 1 — sans quoi l'effet ne serait
 * visible qu'après l'expiration du cache, six heures plus tard.
 *
 * @throws ServiceError('NOT_FOUND') si le compte n'existe pas.
 */
export async function resetUserAdvice(
  actorId: string,
  userId: string,
  level: ResetLevel,
  /** Plantes visées par le niveau 3 ; toutes si absent. */
  plantIds?: string[],
): Promise<ResetOutcome> {
  const exists = await prisma.user.count({ where: { id: userId } })
  if (!exists) throw new ServiceError('NOT_FOUND', 'Utilisateur introuvable')

  let tasksDeleted = 0
  let plantsReset = 0

  if (level === 2) {
    // Les tâches **faites** restent : ce sont des faits, comme les gestes.
    const { count } = await prisma.plantTask.deleteMany({ where: { userId, doneAt: null } })
    tasksDeleted = count
  }

  if (level === 3) {
    const { count } = await prisma.plantInstance.updateMany({
      where: {
        userId,
        ...(plantIds?.length ? { id: { in: plantIds } } : {}),
      },
      data: Object.fromEntries(CARE_TRACKING_COLUMNS.map((column) => [column, null])),
    })
    plantsReset = count
  }

  const gardensInvalidated = await invalidateAllGardenCaches(userId)

  const outcome: ResetOutcome = { level, gardensInvalidated, tasksDeleted, plantsReset }

  // Journalisé après coup et non dans une transaction : l'invalidation du
  // cache touche plusieurs lignes et n'est de toute façon pas réversible.
  // Ce qui compte ici est de garder la trace de ce qui a été fait.
  await logReset(actorId, userId, outcome, plantIds)

  return outcome
}

async function logReset(
  actorId: string,
  userId: string,
  outcome: ResetOutcome,
  plantIds?: string[],
) {
  await logAdminAction({
    actorId,
    action: 'user.reset_advice',
    targetType: 'user',
    targetId: userId,
    details: {
      niveau: outcome.level,
      libelle: RESET_LEVELS[outcome.level],
      jardinsRecalcules: outcome.gardensInvalidated,
      tachesSupprimees: outcome.tasksDeleted,
      plantesReinitialisees: outcome.plantsReset,
      ...(plantIds?.length ? { plantesVisees: plantIds } : {}),
    },
  })
}

// ─── Désactivation et sessions ─────────────────────────────────────────────

export type DisableOutcome = { sessionsRevoked: number; pushTokensRemoved: number }

/**
 * Désactive un compte : la connexion est refusée, les données sont conservées.
 *
 * Poser `disabledAt` ne suffit pas — un access token vit quinze minutes et un
 * refresh token soixante jours. On coupe donc les jetons dans la foulée, et on
 * retire les jetons push : continuer à notifier quelqu'un qu'on vient de
 * fermer dehors serait le comble.
 *
 * @throws ServiceError('NOT_FOUND') · ServiceError('CONFLICT') si déjà désactivé.
 */
export async function disableUser(
  actorId: string,
  userId: string,
): Promise<DisableOutcome> {
  if (actorId === userId) {
    throw new ServiceError('CONFLICT', 'Un administrateur ne peut pas se désactiver lui-même.')
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, disabledAt: true },
  })
  if (!user) throw new ServiceError('NOT_FOUND', 'Utilisateur introuvable')
  if (user.disabledAt) throw new ServiceError('CONFLICT', 'Ce compte est déjà désactivé.')

  return auditWrite(
    async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { disabledAt: new Date() } })

      const { count: sessionsRevoked } = await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      const { count: pushTokensRemoved } = await tx.pushToken.deleteMany({ where: { userId } })

      return { sessionsRevoked, pushTokensRemoved }
    },
    (outcome) => ({
      actorId,
      action: 'user.disable',
      targetType: 'user',
      targetId: userId,
      details: {
        sessionsRevoquees: outcome.sessionsRevoked,
        jetonsPushSupprimes: outcome.pushTokensRemoved,
      },
    }),
  )
}

/**
 * Réactive un compte. Les jetons révoqués ne reviennent pas : l'utilisateur se
 * reconnecte, ce qui est la bonne façon de reprendre une session.
 *
 * @throws ServiceError('NOT_FOUND') · ServiceError('CONFLICT') si déjà actif.
 */
export async function enableUser(actorId: string, userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, disabledAt: true },
  })
  if (!user) throw new ServiceError('NOT_FOUND', 'Utilisateur introuvable')
  if (!user.disabledAt) throw new ServiceError('CONFLICT', 'Ce compte est déjà actif.')

  return auditWrite(
    (tx) => tx.user.update({ where: { id: userId }, data: { disabledAt: null } }),
    {
      actorId,
      action: 'user.enable',
      targetType: 'user',
      targetId: userId,
      details: { desactiveDepuis: user.disabledAt.toISOString() },
    },
  )
}

/**
 * Révoque toutes les sessions mobiles actives. L'utilisateur se reconnecte —
 * c'est l'effet recherché après un téléphone perdu.
 *
 * @throws ServiceError('NOT_FOUND') si le compte n'existe pas.
 */
export async function revokeMobileSessions(actorId: string, userId: string): Promise<number> {
  const exists = await prisma.user.count({ where: { id: userId } })
  if (!exists) throw new ServiceError('NOT_FOUND', 'Utilisateur introuvable')

  return auditWrite(
    async (tx) => {
      const { count } = await tx.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
      return count
    },
    (count) => ({
      actorId,
      action: 'user.revoke_sessions',
      targetType: 'user',
      targetId: userId,
      details: { sessionsRevoquees: count },
    }),
  )
}
