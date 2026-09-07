import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import * as notificationService from '@/lib/services/community/notification.service'

export const dynamic = 'force-dynamic'

/** La cloche : liste paginée, de la plus récente à la plus ancienne. */
export const GET = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const cursor = new URL(request.url).searchParams.get('cursor')
  return ok(await notificationService.listNotifications(userId, cursor))
})
