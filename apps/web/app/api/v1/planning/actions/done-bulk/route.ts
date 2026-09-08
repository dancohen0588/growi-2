import { markActionsDoneBulkSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { markActionsDone } from '@/lib/services/advice.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

/**
 * Coche plusieurs actions d'un coup — « Tout arrosé », « Tout marquer comme
 * fait ». Un seul contrôle d'appartenance, une seule invalidation du cache.
 */
export const POST = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, markActionsDoneBulkSchema)

  return ok(await markActionsDone(userId, input))
})
