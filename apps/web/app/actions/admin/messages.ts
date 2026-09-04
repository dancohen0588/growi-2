'use server'

/**
 * Server Actions du portail d'administration, volet « messagerie ».
 *
 * Même discipline que `users.ts` : `requireAdmin()` à chaque entrée, validation,
 * délégation au service, journalisation. Aucune écriture Prisma ici.
 */

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { contactMessageStatusSchema } from '@growi/shared'

import { logAdminAction } from '@/lib/admin/audit'
import { requireAdmin } from '@/lib/admin/auth'
import { reply, setInternalNote, setStatus } from '@/lib/services/contact.service'
import { isServiceError, ServiceError } from '@/lib/services/errors'

export type ActionResult = { ok: true; message: string } | { ok: false; error: string }

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, message: await fn() }
  } catch (err) {
    if (isServiceError(err)) return { ok: false, error: err.message }
    console.error('[admin] action messagerie en échec', err)
    return { ok: false, error: 'Une erreur est survenue. Réessaie dans un instant.' }
  }
}

function revalidateMessage(id: string) {
  revalidatePath(`/admin/messages/${id}`)
  revalidatePath('/admin/messages')
  revalidatePath('/admin/journal')
  // Le compteur de la navigation vit dans le layout : sans lui, le badge
  // « nouveaux » resterait sur son ancienne valeur après un changement d'état.
  revalidatePath('/admin', 'layout')
}

const replySchema = z.string().trim().min(10, 'Réponse trop courte').max(10_000)

export async function replyToMessageAction(
  messageId: string,
  formData: FormData,
): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()

    const parsed = replySchema.safeParse(formData.get('body'))
    if (!parsed.success) {
      throw new ServiceError('INVALID_INPUT', parsed.error.issues[0].message)
    }

    // L'envoi précède l'écriture : si l'email ne part pas, `reply` lève et rien
    // n'est enregistré. On ne journalise donc que des réponses réellement
    // expédiées.
    const { replyId, providerId } = await reply({
      messageId,
      authorId: admin.id,
      body: parsed.data,
    })

    await logAdminAction({
      actorId: admin.id,
      action: 'contact.reply',
      targetType: 'contact_message',
      targetId: messageId,
      // Le corps de la réponse n'est pas recopié : il est déjà conservé tel
      // qu'expédié dans `ContactReply`, et le journal s'exporte.
      details: { replyId, providerId, longueur: parsed.data.length },
    })

    revalidateMessage(messageId)
    return 'Réponse envoyée.'
  })
}

export async function setMessageStatusAction(
  messageId: string,
  status: string,
): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()

    const parsed = contactMessageStatusSchema.safeParse(status)
    if (!parsed.success) throw new ServiceError('INVALID_INPUT', 'Statut inconnu.')

    await setStatus(messageId, parsed.data)
    await logAdminAction({
      actorId: admin.id,
      action: 'contact.status',
      targetType: 'contact_message',
      targetId: messageId,
      details: { statut: parsed.data },
    })

    revalidateMessage(messageId)
    return parsed.data === 'archived' ? 'Message archivé.' : 'Message rouvert.'
  })
}

export async function setInternalNoteAction(
  messageId: string,
  formData: FormData,
): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()

    const raw = formData.get('note')
    const note = raw === null ? null : String(raw)

    await setInternalNote(messageId, note)
    await logAdminAction({
      actorId: admin.id,
      action: 'contact.note',
      targetType: 'contact_message',
      targetId: messageId,
      // La note elle-même reste hors du journal : elle est éditable, et la
      // recopier à chaque modification y écrirait un historique parallèle.
      details: { videe: !note?.trim() },
    })

    revalidateMessage(messageId)
    return 'Note enregistrée.'
  })
}
