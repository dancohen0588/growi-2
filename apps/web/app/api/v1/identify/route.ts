import { identifyRequestSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { enforceRateLimit } from '@/lib/api/rate-limit'
import { ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { identifyPlant } from '@/lib/services/identify.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'

/**
 * Chaque identification consomme un appel Gemini facturé. La limite est posée
 * par utilisateur — et non par IP — puisque la route est authentifiée : c'est
 * le compte qui engage la dépense, pas la connexion.
 */
const RATE_LIMIT = { limit: 30, windowMs: 60 * 60 * 1000 }

export const POST = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  enforceRateLimit(`identify:${userId}`, RATE_LIMIT)

  const { imageBase64 } = await parseJsonBody(request, identifyRequestSchema)
  return ok(await identifyPlant(imageBase64))
})
