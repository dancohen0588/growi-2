/**
 * Journal des actions d'administration.
 *
 * Dès qu'un compte peut lire et modifier les données d'un autre, la question
 * n'est plus « qui a le droit » mais « qui l'a fait, et quand ». Le journal est
 * **append-only** : rien dans l'application ne le modifie ni ne l'efface.
 *
 * Il s'écrit **dans la même transaction** que l'action qu'il décrit chaque fois
 * que c'est possible (`auditWrite`), pour qu'une action sans trace soit
 * impossible plutôt que simplement improbable.
 */

import type { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'

/**
 * Actions journalisables, avec leur libellé français.
 *
 * Ajouter une entrée ici est la première chose à faire en écrivant une nouvelle
 * action admin : le type l'impose ensuite à l'appel de `logAdminAction`.
 * Certaines valeurs anticipent les phases suivantes (messagerie, profil) — le
 * journal doit savoir les afficher le jour où elles arrivent.
 */
export const ADMIN_ACTIONS = {
  'user.update': 'Modification du profil',
  'user.reset_advice': 'Réinitialisation des recommandations',
  'user.disable': 'Désactivation du compte',
  'user.enable': 'Réactivation du compte',
  'user.revoke_sessions': 'Révocation des sessions mobiles',
  'user.export': 'Export CSV de la liste des utilisateurs',
  'admin.promote': "Attribution du rôle d'administrateur",
  'admin.demote': "Retrait du rôle d'administrateur",
  'contact.reply': 'Réponse à un message',
  'contact.status': "Changement de statut d'un message",
  'contact.note': 'Note interne sur un message',
} as const

export type AdminAction = keyof typeof ADMIN_ACTIONS

export function adminActionLabel(action: string): string {
  return ADMIN_ACTIONS[action as AdminAction] ?? action
}

/** Nature de la cible, pour construire le lien vers sa fiche. */
export const AUDIT_TARGET_TYPES = {
  user: 'Utilisateur',
  contact_message: 'Message',
  garden: 'Jardin',
  plant_instance: 'Plante',
} as const

export type AuditTargetType = keyof typeof AUDIT_TARGET_TYPES

export function auditTargetLabel(targetType: string): string {
  return AUDIT_TARGET_TYPES[targetType as AuditTargetType] ?? targetType
}

export type AuditEntryInput = {
  actorId: string
  action: AdminAction
  targetType: AuditTargetType
  targetId: string
  /** Avant/après ou paramètres. Voir `assertNoSecrets`. */
  details?: Prisma.InputJsonValue
}

/**
 * Champs qu'un `details` ne doit jamais porter.
 *
 * Le journal est lu dans l'interface et exporté ; y recopier un condensat de
 * mot de passe ou une empreinte de jeton reviendrait à défaire le soin pris
 * partout ailleurs à ne pas les exposer. La liste blanche des champs éditables
 * (§6.2) rend le cas improbable — ce garde-fou le rend impossible.
 */
const FORBIDDEN_DETAIL_KEYS = ['password', 'tokenHash', 'token', 'accessToken', 'refreshToken', 'id_token']

function assertNoSecrets(details: Prisma.InputJsonValue, path = 'details'): void {
  if (details === null || typeof details !== 'object') return

  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    if (FORBIDDEN_DETAIL_KEYS.includes(key)) {
      throw new Error(`[admin] ${path}.${key} n'a rien à faire dans le journal d'audit`)
    }
    if (value && typeof value === 'object') {
      assertNoSecrets(value as Prisma.InputJsonValue, `${path}.${key}`)
    }
  }
}

/**
 * Écrit une entrée de journal.
 *
 * À préférer sous sa forme transactionnelle (`auditWrite`) quand l'action
 * elle-même est une écriture Prisma.
 */
export async function logAdminAction(entry: AuditEntryInput): Promise<void> {
  if (entry.details !== undefined) assertNoSecrets(entry.details)

  await prisma.adminAuditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId,
      details: entry.details,
    },
  })
}

/**
 * Exécute une écriture et la journalise **atomiquement**.
 *
 * `write` reçoit le client transactionnel : tout ce qu'il fait est annulé si
 * l'écriture du journal échoue, et réciproquement. C'est la forme à employer
 * dès qu'une action admin modifie la base.
 *
 * `entry` peut être calculé à partir du résultat de l'écriture — c'est
 * nécessaire pour journaliser un « avant / après ».
 */
export async function auditWrite<T>(
  write: (tx: Prisma.TransactionClient) => Promise<T>,
  entry: AuditEntryInput | ((result: T) => AuditEntryInput),
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    const result = await write(tx)
    const resolved = typeof entry === 'function' ? entry(result) : entry

    if (resolved.details !== undefined) assertNoSecrets(resolved.details)

    await tx.adminAuditLog.create({
      data: {
        actorId: resolved.actorId,
        action: resolved.action,
        targetType: resolved.targetType,
        targetId: resolved.targetId,
        details: resolved.details,
      },
    })

    return result
  })
}
