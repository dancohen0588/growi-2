import { refreshTokenSchema } from '@growi/shared'

import { ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as authService from '@/lib/services/auth.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

/**
 * Échange un refresh token contre un nouveau couple, avec rotation.
 *
 * Pas de limitation de débit ici : l'app rafraîchit légitimement à chaque
 * expiration d'access token, et la protection réelle vient de la rotation —
 * un jeton rejoué révoque toute la famille.
 */
export const POST = withApiErrorHandling(async (request: Request) => {
  const { refreshToken } = await parseJsonBody(request, refreshTokenSchema)
  return ok(await authService.refresh(refreshToken))
})
