import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import * as profileService from '@/lib/services/community/profile.service'

export const dynamic = 'force-dynamic'

/** « Comptes bloqués », dans les réglages de la communauté. */
export const GET = withApiErrorHandling(async () => {
  const userId = await requireUserId()
  return ok(await profileService.listBlocked(userId))
})
