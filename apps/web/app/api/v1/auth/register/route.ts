import { mobileRegisterSchema } from '@growi/shared'

import { clientKey, enforceRateLimit } from '@/lib/api/rate-limit'
import { created, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as authService from '@/lib/services/auth.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

/**
 * Création de compte : 10 par heure et par IP.
 * Assez pour ne pas gêner un foyer ou un bureau derrière une IP partagée,
 * assez bas pour freiner la création massive de comptes.
 */
const RATE_LIMIT = { limit: 10, windowMs: 60 * 60 * 1000 }

export const POST = withApiErrorHandling(async (request: Request) => {
  enforceRateLimit(clientKey(request, 'auth:register'), RATE_LIMIT)

  const input = await parseJsonBody(request, mobileRegisterSchema)
  return created(await authService.register(input))
})
