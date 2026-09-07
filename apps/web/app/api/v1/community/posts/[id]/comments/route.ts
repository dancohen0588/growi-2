import { createCommentSchema } from '@growi/shared'

import { optionalUserId, requireUserId } from '@/lib/api/auth-context'
import { created, ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as postService from '@/lib/services/community/post.service'

export const dynamic = 'force-dynamic'

type Context = { params: { id: string } }

/** Commentaires paginés, à plat, du plus récent au plus ancien. */
export const GET = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const viewerId = await optionalUserId()
  const cursor = new URL(request.url).searchParams.get('cursor')
  return ok(await postService.listComments(params.id, viewerId, cursor))
})

export const POST = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, createCommentSchema)
  return created(await postService.addComment(params.id, userId, input))
})
