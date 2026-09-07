import { updateCommunitySettingsSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as profileService from '@/lib/services/community/profile.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

export const GET = withApiErrorHandling(async () => {
  const userId = await requireUserId()
  return ok(await profileService.getSettings(userId))
})

/** Active, modifie ou désactive le profil public — voir `updateSettings`. */
export const PATCH = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, updateCommunitySettingsSchema)
  return ok(await profileService.updateSettings(userId, input))
})
