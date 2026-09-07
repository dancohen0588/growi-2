import { updatePostSchema } from '@growi/shared'

import { optionalUserId, requireUserId } from '@/lib/api/auth-context'
import { noContent, ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as postService from '@/lib/services/community/post.service'

export const dynamic = 'force-dynamic'

type Context = { params: { id: string } }

/**
 * Détail d'une publication, avec sa première page de commentaires.
 *
 * Lisible sans compte : c'est ce qui rend un lien partageable hors de l'app.
 * Une lecture anonyme n'emporte ni `likedByMe` ni distance.
 */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const viewerId = await optionalUserId()
  return ok(await postService.getPost(params.id, viewerId))
})

/** Le texte seul — les photos ne se remplacent pas. */
export const PATCH = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, updatePostSchema)
  return ok(await postService.updatePost(params.id, userId, input))
})

export const DELETE = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  await postService.deletePost(params.id, userId)
  return noContent()
})
