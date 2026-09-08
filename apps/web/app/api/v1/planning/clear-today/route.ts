import { clearPlanningTodaySchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { noContent, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { clearPlanningToday } from '@/lib/services/advice.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

/**
 * Masque les actions du moteur jusqu'à demain — « Ignorer pour aujourd'hui »,
 * et son « Rétablir » avec `undo: true`.
 *
 * Rien n'est écrit au journal des plantes : c'est toute la différence avec
 * « Tout marquer comme fait ».
 */
export const POST = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, clearPlanningTodaySchema)

  await clearPlanningToday(userId, input)
  return noContent()
})
