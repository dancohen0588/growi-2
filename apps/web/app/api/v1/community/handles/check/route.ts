import { optionalUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import * as profileService from '@/lib/services/community/profile.service'

export const dynamic = 'force-dynamic'

/**
 * Disponibilité d'un pseudo, appelée à la frappe sur l'écran d'activation.
 *
 * `optionalUserId` plutôt que `requireUserId` : la vérification sert aussi au
 * formulaire d'inscription web, où il n'y a pas encore de session. Elle ne
 * révèle rien qu'une tentative d'activation ne révélerait — un pseudo pris est
 * de toute façon affiché sur son profil public.
 */
export const GET = withApiErrorHandling(async (request: Request) => {
  const userId = await optionalUserId()
  const handle = new URL(request.url).searchParams.get('handle') ?? ''
  return ok(await profileService.checkHandle(handle, userId))
})
