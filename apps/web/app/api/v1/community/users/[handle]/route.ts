import { optionalUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import * as profileService from '@/lib/services/community/profile.service'

export const dynamic = 'force-dynamic'

type Context = { params: { handle: string } }

/**
 * Profil public. Lisible **sans compte** : c'est ce qui rend un lien de profil
 * partageable hors de l'app, et ce que la page web `(public)/u/[handle]`
 * consomme. Une lecture anonyme n'emporte ni `isFollowing` ni distance.
 */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const viewerId = await optionalUserId()
  return ok(await profileService.getProfileByHandle(params.handle, viewerId))
})
