import { undoActionSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { noContent, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { undoAction } from '@/lib/services/advice.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

/**
 * Annule un geste noté par erreur : le geste est effacé du journal, la date de
 * la plante recalculée depuis le précédent, et la tâche acquittée rouverte.
 */
export const POST = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, undoActionSchema)

  await undoAction(userId, input)
  return noContent()
})
