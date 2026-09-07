import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import * as notificationService from '@/lib/services/community/notification.service'

export const dynamic = 'force-dynamic'

/**
 * Tout marquer lu.
 *
 * Tout, et non ligne par ligne : la cloche se consulte d'un coup d'œil, et
 * cocher vingt lignes pour éteindre un badge serait une corvée sans
 * contrepartie. Répond le nouveau compte de non-lus, pour que le badge
 * s'éteigne sans second appel.
 */
export const POST = withApiErrorHandling(async () => {
  const userId = await requireUserId()
  return ok(await notificationService.markAllRead(userId))
})
