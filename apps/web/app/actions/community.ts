'use server'

/**
 * Server Actions de la communauté, côté web.
 *
 * Le mobile passe par `/api/v1/community/*` ; le web appelle les mêmes
 * services directement, comme le reste du tableau de bord. Une seule règle en
 * découle : **l'authentification est refaite ici**. Une Server Action est un
 * point d'entrée à part entière, et le `redirect('/login')` d'une page ne la
 * protège pas.
 */

import { revalidatePath } from 'next/cache'
import {
  createCommentSchema,
  createReportSchema,
  sendListingMessageSchema,
  updateListingSchema,
} from '@growi/shared'

import { auth } from '@/auth'
import * as listingService from '@/lib/services/community/listing.service'
import { markAllRead } from '@/lib/services/community/notification.service'
import * as moderationService from '@/lib/services/community/moderation.service'
import * as postService from '@/lib/services/community/post.service'
import * as profileService from '@/lib/services/community/profile.service'
import { isServiceError, ServiceError } from '@/lib/services/errors'

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string }

/** @throws ServiceError('UNAUTHENTICATED') — jamais un `redirect`, qui casserait le retour. */
async function requireUser(): Promise<string> {
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) throw new ServiceError('UNAUTHENTICATED', 'Reconnecte-toi pour continuer.')
  return userId
}

async function run(fn: (userId: string) => Promise<string | undefined>): Promise<ActionResult> {
  try {
    return { ok: true, message: await fn(await requireUser()) }
  } catch (err) {
    if (isServiceError(err)) return { ok: false, error: err.message }
    console.error('[communauté] action web en échec', err)
    return { ok: false, error: 'Une erreur est survenue. Réessaie dans un instant.' }
  }
}

// ─── Publications ──────────────────────────────────────────────────────────

export async function toggleLikeAction(postId: string, liked: boolean): Promise<ActionResult> {
  return run(async (userId) => {
    await postService.setLike(postId, userId, liked)
    revalidatePath('/dashboard/communaute')
    revalidatePath(`/p/${postId}`)
    return undefined
  })
}

export async function addCommentAction(
  postId: string,
  formData: FormData,
): Promise<ActionResult> {
  return run(async (userId) => {
    const parsed = createCommentSchema.safeParse({ body: formData.get('body') })
    if (!parsed.success) {
      throw new ServiceError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Commentaire invalide')
    }

    await postService.addComment(postId, userId, parsed.data)
    revalidatePath(`/p/${postId}`)
    return 'Commentaire publié.'
  })
}

export async function deleteCommentAction(
  commentId: string,
  postId: string,
): Promise<ActionResult> {
  return run(async (userId) => {
    await postService.deleteComment(commentId, userId)
    revalidatePath(`/p/${postId}`)
    return 'Commentaire supprimé.'
  })
}

export async function deletePostAction(postId: string): Promise<ActionResult> {
  return run(async (userId) => {
    await postService.deletePost(postId, userId)
    revalidatePath('/dashboard/communaute')
    return 'Publication supprimée.'
  })
}

// ─── Abonnements et blocage ────────────────────────────────────────────────

export async function toggleFollowAction(handle: string, next: boolean): Promise<ActionResult> {
  return run(async (userId) => {
    if (next) await profileService.follow(userId, handle)
    else await profileService.unfollow(userId, handle)

    revalidatePath(`/u/${handle}`)
    revalidatePath('/dashboard/communaute')
    return undefined
  })
}

export async function toggleBlockAction(handle: string, next: boolean): Promise<ActionResult> {
  return run(async (userId) => {
    if (next) await profileService.block(userId, handle)
    else await profileService.unblock(userId, handle)

    revalidatePath(`/u/${handle}`)
    revalidatePath('/dashboard/communaute')
    return next ? 'Compte bloqué.' : 'Compte débloqué.'
  })
}

// ─── Bourse ────────────────────────────────────────────────────────────────

export async function expressInterestAction(listingId: string): Promise<ActionResult> {
  return run(async (userId) => {
    await listingService.expressInterest(listingId, userId)
    revalidatePath(`/dashboard/communaute/bourse/${listingId}`)
    revalidatePath('/dashboard/communaute/messages')
    return 'Discussion ouverte — retrouve-la dans Messages.'
  })
}

export async function updateListingAction(
  listingId: string,
  patch: { status?: 'active' | 'reserved' | 'done'; extend?: boolean },
): Promise<ActionResult> {
  return run(async (userId) => {
    const parsed = updateListingSchema.safeParse(patch)
    if (!parsed.success) throw new ServiceError('INVALID_INPUT', 'Modification invalide')

    await listingService.updateListing(listingId, userId, parsed.data)
    revalidatePath(`/dashboard/communaute/bourse/${listingId}`)
    revalidatePath('/dashboard/communaute/bourse')
    return 'Annonce mise à jour.'
  })
}

export async function sendThreadMessageAction(
  threadId: string,
  formData: FormData,
): Promise<ActionResult> {
  return run(async (userId) => {
    const parsed = sendListingMessageSchema.safeParse({ body: formData.get('body') })
    if (!parsed.success) {
      throw new ServiceError('INVALID_INPUT', parsed.error.issues[0]?.message ?? 'Message invalide')
    }

    await listingService.sendMessage(threadId, userId, parsed.data)
    revalidatePath(`/dashboard/communaute/messages/${threadId}`)
    revalidatePath('/dashboard/communaute/messages')
    return undefined
  })
}

// ─── Notifications et signalement ──────────────────────────────────────────

export async function markNotificationsReadAction(): Promise<ActionResult> {
  return run(async (userId) => {
    await markAllRead(userId)
    revalidatePath('/dashboard/communaute/notifications')
    revalidatePath('/dashboard', 'layout')
    return undefined
  })
}

export async function reportAction(
  targetType: string,
  targetId: string,
  formData: FormData,
): Promise<ActionResult> {
  return run(async (userId) => {
    const parsed = createReportSchema.safeParse({
      targetType,
      targetId,
      reason: formData.get('reason'),
      note: formData.get('note') || undefined,
    })
    if (!parsed.success) throw new ServiceError('INVALID_INPUT', 'Signalement invalide')

    await moderationService.report(userId, parsed.data)
    return 'Merci — nous allons vérifier.'
  })
}
