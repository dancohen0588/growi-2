import { secretSlugSchema, trySecretSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { trySecret } from '@/lib/services/secrets.service'

export const dynamic = 'force-dynamic'

type Context = { params: { slug: string } }

/**
 * « Je tente » : le secret s'ajoute au calendrier en tâche à faire. Rien
 * n'est inscrit au journal — l'essai le sera quand la tâche sera cochée.
 * Idempotent : retaper le bouton rend la même tâche.
 */
export const POST = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const userId = await requireUserId()
  const slug = secretSlugSchema.parse(params.slug)
  const input = await parseJsonBody(request, trySecretSchema)
  const task = await trySecret(userId, slug, input)
  return ok({ taskId: task.taskId!, dueDate: task.dueDate })
})
