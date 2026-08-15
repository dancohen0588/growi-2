import { refreshTokenSchema } from '@growi/shared'

import { noContent, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as authService from '@/lib/services/auth.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

/**
 * Révoque la session portée par ce refresh token.
 *
 * Volontairement idempotent et sans authentification par access token : la
 * déconnexion doit aboutir même si l'access token a expiré entre-temps.
 */
export const POST = withApiErrorHandling(async (request: Request) => {
  const { refreshToken } = await parseJsonBody(request, refreshTokenSchema)
  await authService.logout(refreshToken)
  return noContent()
})
