'use server'

/**
 * Server Actions du portail d'administration, volet « modération ».
 *
 * Même discipline que `users.ts` et `messages.ts` : `requireAdmin()` à chaque
 * entrée — une Server Action est un point d'entrée à part entière, et le
 * `requireAdmin()` du layout ne la protège pas —, validation, délégation au
 * service, journalisation.
 */

import { revalidatePath } from 'next/cache'
import { REPORT_TARGETS, type ReportTarget } from '@growi/shared'

import { logAdminAction, type AuditTargetType } from '@/lib/admin/audit'
import { requireAdmin } from '@/lib/admin/auth'
import { resolveReports, setModerationStatus } from '@/lib/services/community/moderation.service'
import { isServiceError, ServiceError } from '@/lib/services/errors'

export type ActionResult = { ok: true; message: string } | { ok: false; error: string }

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, message: await fn() }
  } catch (err) {
    if (isServiceError(err)) return { ok: false, error: err.message }
    console.error('[admin] action de modération en échec', err)
    return { ok: false, error: 'Une erreur est survenue. Réessaie dans un instant.' }
  }
}

function revalidateModeration() {
  revalidatePath('/admin/signalements')
  revalidatePath('/admin/journal')
  // Le badge de la navigation vit dans le layout : sans lui, le compteur de
  // signalements ouverts resterait sur son ancienne valeur.
  revalidatePath('/admin', 'layout')
}

/** Les cibles que le portail sait traiter, telles qu'elles arrivent du formulaire. */
function parseTarget(targetType: string, targetId: string): ReportTarget {
  if (!REPORT_TARGETS.includes(targetType as ReportTarget) || !targetId) {
    throw new ServiceError('INVALID_INPUT', 'Cible inconnue.')
  }
  return targetType as ReportTarget
}

/**
 * Masque ou rétablit un contenu, et clôt ses signalements.
 *
 * Les deux vont ensemble : masquer sans clore laisserait le contenu remonter
 * dans la file à chaque rechargement, et l'administrateur reprendrait la même
 * décision indéfiniment.
 */
export async function moderateContentAction(
  targetType: string,
  targetId: string,
  hide: boolean,
): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()
    const target = parseTarget(targetType, targetId)

    const { previousStatus } = await setModerationStatus(target, targetId, hide)
    await resolveReports(target, targetId, 'actioned', admin.id)

    await logAdminAction({
      actorId: admin.id,
      action: hide ? 'moderation.hide' : 'moderation.restore',
      targetType: target as AuditTargetType,
      targetId,
      // Le contenu lui-même n'est pas recopié dans le journal : il est toujours
      // en base, et le journal s'exporte.
      details: { avant: previousStatus, apres: hide ? 'hidden' : 'visible' },
    })

    revalidateModeration()
    return hide ? 'Contenu masqué.' : 'Contenu rétabli.'
  })
}

/**
 * Rejette les signalements d'un contenu sans y toucher.
 *
 * Le contenu reste tel qu'il est — y compris masqué automatiquement : rejeter
 * un signalement, c'est dire qu'il ne méritait pas de suite, pas nécessairement
 * que le contenu doit revenir. Pour le rétablir, il y a le bouton d'à côté.
 */
export async function dismissReportsAction(
  targetType: string,
  targetId: string,
): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()
    const target = parseTarget(targetType, targetId)

    const count = await resolveReports(target, targetId, 'dismissed', admin.id)
    if (count === 0) {
      throw new ServiceError('NOT_FOUND', 'Ces signalements ont déjà été traités.')
    }

    await logAdminAction({
      actorId: admin.id,
      action: 'moderation.dismiss',
      targetType: target as AuditTargetType,
      targetId,
      details: { signalements: count },
    })

    revalidateModeration()
    return count === 1 ? 'Signalement rejeté.' : `${count} signalements rejetés.`
  })
}
