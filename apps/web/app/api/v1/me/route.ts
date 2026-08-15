import { updateProfileSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as userService from '@/lib/services/user.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

export const GET = withApiErrorHandling(async () => {
  const userId = await requireUserId()
  return ok(await userService.getProfile(userId))
})

export const PATCH = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, updateProfileSchema)
  return ok(await userService.updateProfile(userId, input))
})
