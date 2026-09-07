import { createPostSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { created, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as postService from '@/lib/services/community/post.service'

export const dynamic = 'force-dynamic'

/** Publier. Les photos ont déjà été déposées par `/api/v1/uploads` (kind `post`). */
export const POST = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, createPostSchema)
  return created(await postService.createPost(userId, input))
})
