import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { getGrimoire } from '@/lib/services/secrets.service'

export const dynamic = 'force-dynamic'

/** La collection des secrets : découverts, essayés, et ceux qui restent à trouver. */
export const GET = withApiErrorHandling(async () => {
  const userId = await requireUserId()
  return ok(await getGrimoire(userId))
})
