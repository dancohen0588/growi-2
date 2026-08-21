import { markActionDoneSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { noContent, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { markActionDone } from '@/lib/services/advice.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

/**
 * Coche une tâche du planning : enregistre le geste correspondant sur la
 * plante et rafraîchit les conseils du jardin.
 */
export const POST = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, markActionDoneSchema)

  await markActionDone(userId, input)
  return noContent()
})
