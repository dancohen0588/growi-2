import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import * as postService from '@/lib/services/community/post.service'

export const dynamic = 'force-dynamic'

type Context = { params: { id: string } }

/** Idempotent : le double tap d'une carte qu'on fait défiler est fréquent. */
export const POST = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  return ok(await postService.setLike(params.id, userId, true))
})

export const DELETE = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  return ok(await postService.setLike(params.id, userId, false))
})
