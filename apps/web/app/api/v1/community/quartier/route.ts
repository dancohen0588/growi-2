import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { getQuartier } from '@/lib/services/community/quartier.service'

export const dynamic = 'force-dynamic'

/**
 * Ton quartier : le défi de la semaine, ce qui a circulé, les Secrets qui
 * marchent ici et tes mercis de la semaine. 403 sans profil public — n'y
 * comptent et n'y lisent que ceux qui ont rejoint la Communauté.
 */
export const GET = withApiErrorHandling(async () => {
  const userId = await requireUserId()
  return ok(await getQuartier(userId))
})
