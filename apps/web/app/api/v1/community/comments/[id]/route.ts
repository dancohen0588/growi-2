import { requireUserId } from '@/lib/api/auth-context'
import { noContent, withApiErrorHandling } from '@/lib/api/response'
import * as postService from '@/lib/services/community/post.service'

export const dynamic = 'force-dynamic'

type Context = { params: { id: string } }

/** Le sien, ou n'importe lequel sur sa propre publication. */
export const DELETE = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  await postService.deleteComment(params.id, userId)
  return noContent()
})
