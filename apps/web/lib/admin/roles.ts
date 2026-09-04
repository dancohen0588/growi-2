/**
 * Attribution et retrait du rôle d'administrateur.
 *
 * Deux garde-fous, tous deux là pour empêcher de se retrouver enfermé dehors :
 * on ne se rétrograde pas soi-même, et on ne rétrograde pas le dernier
 * administrateur. Sans eux, un seul clic malheureux rendrait `/admin`
 * inaccessible à tout le monde, et il faudrait repasser par le script
 * d'amorçage avec un accès à la base de production.
 *
 * Ces fonctions ne lisent pas la session : c'est l'appelant (script d'amorçage
 * en phase 1, Server Actions ensuite) qui authentifie et journalise.
 */

import type { UserRole } from '@growi/shared'

import { prisma } from '@/lib/prisma'
import { ServiceError } from '@/lib/services/errors'

export type AdminAccount = {
  id: string
  email: string
  name: string | null
  role: string
}

const ACCOUNT_SELECT = { id: true, email: true, name: true, role: true } as const

/** Comptes portant le rôle `ADMIN`, du plus ancien au plus récent. */
export async function listAdmins(): Promise<AdminAccount[]> {
  return prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: ACCOUNT_SELECT,
    orderBy: { createdAt: 'asc' },
  })
}

/**
 * Promeut un compte **existant** au rôle d'administrateur. Idempotent : un
 * compte déjà administrateur est renvoyé tel quel.
 *
 * @throws ServiceError('NOT_FOUND') si le compte n'existe pas.
 * @throws ServiceError('CONFLICT') si le compte est désactivé — lui donner des
 * droits qu'il ne pourra pas exercer ne ferait qu'égarer.
 */
export async function promoteAdmin(userId: string): Promise<AdminAccount> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { ...ACCOUNT_SELECT, disabledAt: true },
  })
  if (!user) throw new ServiceError('NOT_FOUND', 'Utilisateur introuvable')

  if (user.disabledAt) {
    throw new ServiceError('CONFLICT', 'Un compte désactivé ne peut pas être promu administrateur.')
  }

  if (user.role === 'ADMIN') {
    return { id: user.id, email: user.email, name: user.name, role: user.role }
  }

  return prisma.user.update({
    where: { id: userId },
    data: { role: 'ADMIN' satisfies UserRole },
    select: ACCOUNT_SELECT,
  })
}

/**
 * Retire le rôle d'administrateur.
 *
 * @throws ServiceError('NOT_FOUND') si le compte n'existe pas.
 * @throws ServiceError('CONFLICT') si l'on tente de se rétrograder soi-même ou
 * de retirer le dernier administrateur.
 */
export async function demoteAdmin(userId: string, actorId: string): Promise<AdminAccount> {
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

  return prisma.user.update({
    where: { id: userId },
    data: { role: 'USER' satisfies UserRole },
    select: ACCOUNT_SELECT,
  })
}
