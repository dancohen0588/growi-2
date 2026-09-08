import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { reviewOpenTasks } from '@/lib/services/task.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

type Context = { params: { id: string; diagnosisId: string } }

/**
 * Ce que devient chaque action déjà ouverte sur la plante, face à ce
 * diagnostic. Une proposition : rien n'est écrit tant que l'utilisateur n'a pas
 * confirmé depuis `POST …/plan`.
 */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  return ok(await reviewOpenTasks(userId, params.id, params.diagnosisId))
})
