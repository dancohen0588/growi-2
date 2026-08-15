import { mobileLoginSchema } from '@growi/shared'

import { clientKey, enforceRateLimit } from '@/lib/api/rate-limit'
import { ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as authService from '@/lib/services/auth.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

/** 10 tentatives par quart d'heure et par IP, pour freiner le bourrage d'identifiants. */
const RATE_LIMIT = { limit: 10, windowMs: 15 * 60 * 1000 }

export const POST = withApiErrorHandling(async (request: Request) => {
  enforceRateLimit(clientKey(request, 'auth:login'), RATE_LIMIT)

  const input = await parseJsonBody(request, mobileLoginSchema)
  return ok(await authService.login(input))
})
