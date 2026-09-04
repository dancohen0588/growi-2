/**
 * Attribution et retrait du rôle d'administrateur.
 *
 * Deux garde-fous, tous deux là pour empêcher de se retrouver enfermé dehors :
 * on ne se rétrograde pas soi-même, et on ne rétrograde pas le dernier
 * administrateur. Sans eux, un seul clic malheureux rendrait `/admin`
 * inaccessible à tout le monde, et il faudrait repasser par le script
 * d'amorçage avec un accès à la base de production.
 *
 * Ces fonctions ne lisent pas la session : l'appelant authentifie et transmet
 * l'`actorId`. Comme toutes les écritures de l'admin, elles passent par
 * `auditWrite` — le changement de rôle et sa trace tiennent dans une seule
 * transaction.
 */

import type { UserRole } from '@growi/shared'

import { auditWrite } from '@/lib/admin/audit'
import { prisma } from '@/lib/prisma'
import { ServiceError } from '@/lib/services/errors'

export type AdminAccount = {
  id: string
  email: string
  name: string | null
  firstName: string | null
  lastName: string | null
  role: string
  disabledAt: Date | null
  createdAt: Date
}

const ACCOUNT_SELECT = {
  id: true,
  email: true,
  name: true,
  firstName: true,
  lastName: true,
  role: true,
  disabledAt: true,
  createdAt: true,
} as const

/** Comptes portant le rôle `ADMIN`, du plus ancien au plus récent. */
export async function listAdmins(): Promise<AdminAccount[]> {
  return prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: ACCOUNT_SELECT,
    orderBy: { createdAt: 'asc' },
  })
}

export type AdminWithPromotion = AdminAccount & {
  /** Quand le rôle a été attribué, d'après le journal. */
  promotedAt: Date | null
  /** Par qui. `null` pour les administrateurs d'avant le journal, ou promus par script. */
  promotedBy: { id: string; email: string } | null
}

/**
 * Les administrateurs, avec l'origine de leurs droits.
 *
 * L'information vient du **journal d'audit**, seul endroit qui la porte : le
 * modèle `User` ne garde qu'un rôle, sans mémoire de qui l'a posé. Un
 * administrateur promu par le script d'amorçage n'a donc pas de trace — c'est
 * normal, et l'écran le dit plutôt que d'inventer.
 */
export async function listAdminsWithPromotion(): Promise<AdminWithPromotion[]> {
  const admins = await listAdmins()
  if (admins.length === 0) return []

  const entries = await prisma.adminAuditLog.findMany({
    where: { action: 'admin.promote', targetType: 'user', targetId: { in: admins.map((a) => a.id) } },
    orderBy: { createdAt: 'desc' },
    select: {
      targetId: true,
      createdAt: true,
      actor: { select: { id: true, email: true } },
    },
  })

  // La plus récente l'emporte : un compte peut avoir été rétrogradé puis repromu.
  const latest = new Map<string, (typeof entries)[number]>()
  for (const entry of entries) {
    if (!latest.has(entry.targetId)) latest.set(entry.targetId, entry)
  }

  return admins.map((admin) => {
    const entry = latest.get(admin.id)
    return {
      ...admin,
      promotedAt: entry?.createdAt ?? null,
      promotedBy: entry?.actor ?? null,
    }
  })
}

/**
 * Cherche un compte par email, pour la promotion.
 *
 * Insensible à la casse, comme le rattachement des messages : personne ne
 * retient si son compte a été créé avec une majuscule.
 */
export async function findAccountByEmail(email: string): Promise<AdminAccount | null> {
  const trimmed = email.trim()
  if (!trimmed) return null

  return prisma.user.findFirst({
    where: { email: { equals: trimmed, mode: 'insensitive' } },
    select: ACCOUNT_SELECT,
  })
}

/**
 * Promeut un compte **existant** au rôle d'administrateur. Idempotent : un
 * compte déjà administrateur est renvoyé tel quel, sans nouvelle trace.
 *
 * @throws ServiceError('NOT_FOUND') si le compte n'existe pas.
 * @throws ServiceError('CONFLICT') si le compte est désactivé — lui donner des
 * droits qu'il ne pourra pas exercer ne ferait qu'égarer.
 */
export async function promoteAdmin(actorId: string, userId: string): Promise<AdminAccount> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: ACCOUNT_SELECT })
  if (!user) throw new ServiceError('NOT_FOUND', 'Utilisateur introuvable')

  if (user.disabledAt) {
    throw new ServiceError('CONFLICT', 'Un compte désactivé ne peut pas être promu administrateur.')
  }

  if (user.role === 'ADMIN') return user

  return auditWrite(
    (tx) =>
      tx.user.update({
        where: { id: userId },
        data: { role: 'ADMIN' satisfies UserRole },
        select: ACCOUNT_SELECT,
      }),
    {
      actorId,
      action: 'admin.promote',
      targetType: 'user',
      targetId: userId,
      details: { email: user.email, avant: user.role },
    },
  )
}

/**
 * Retire le rôle d'administrateur.
 *
 * @throws ServiceError('NOT_FOUND') si le compte n'existe pas.
 * @throws ServiceError('CONFLICT') si l'on tente de se rétrograder soi-même ou
 * de retirer le dernier administrateur.
 */
export async function demoteAdmin(actorId: string, userId: string): Promise<AdminAccount> {
  if (userId === actorId) {
    throw new ServiceError('CONFLICT', 'Un administrateur ne peut pas se retirer ses propres droits.')
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: ACCOUNT_SELECT })
  if (!user) throw new ServiceError('NOT_FOUND', 'Utilisateur introuvable')

  if (user.role !== 'ADMIN') return user

  const admins = await prisma.user.count({ where: { role: 'ADMIN' } })
  if (admins <= 1) {
    throw new ServiceError(
      'CONFLICT',
      "Impossible de retirer le dernier administrateur : le portail deviendrait inaccessible.",
    )
  }

  return auditWrite(
    (tx) =>
      tx.user.update({
        where: { id: userId },
        data: { role: 'USER' satisfies UserRole },
        select: ACCOUNT_SELECT,
      }),
    {
      actorId,
      action: 'admin.demote',
      targetType: 'user',
      targetId: userId,
      details: { email: user.email },
    },
  )
}
