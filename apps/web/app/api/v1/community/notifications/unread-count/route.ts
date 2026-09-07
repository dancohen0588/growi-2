import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import * as notificationService from '@/lib/services/community/notification.service'

export const dynamic = 'force-dynamic'

/**
 * Le badge de la cloche.
 *
 * Route à part, et volontairement minuscule : elle est appelée à chaque
 * ouverture de l'accueil, là où la liste complète ne l'est qu'au tap.
 */
export const GET = withApiErrorHandling(async () => {
  const userId = await requireUserId()
  return ok(await notificationService.unreadCount(userId))
})
