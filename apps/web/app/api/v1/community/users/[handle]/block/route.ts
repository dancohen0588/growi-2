import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import * as profileService from '@/lib/services/community/profile.service'

export const dynamic = 'force-dynamic'

type Context = { params: { handle: string } }

/** Bloquer — rompt les abonnements dans les deux sens (voir `block`). */
export const POST = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  return ok(await profileService.block(userId, params.handle))
})

export const DELETE = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  return ok(await profileService.unblock(userId, params.handle))
})
