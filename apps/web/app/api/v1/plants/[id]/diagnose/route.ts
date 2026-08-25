import { diagnoseRequestSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
// TODO rate limit : décision produit, pas de limite en v1. Si les coûts Gemini
// dérivent, il suffit d'importer `enforceRateLimit` et de décommenter l'appel
// ci-dessous — la route est déjà authentifiée, donc limitable par compte.
// import { enforceRateLimit } from '@/lib/api/rate-limit'
import { ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { diagnosePlant } from '@/lib/services/diagnosis.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'

type Context = { params: { id: string } }

/**
 * Diagnostique une plante de l'utilisateur à partir d'une photo.
 *
 * Répond 200 même quand le modèle n'a pas su juger : le corps porte alors
 * `diagnosed: false` et un motif affichable. Un échec d'analyse est un
 * résultat, pas une panne.
 */
export const POST = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const userId = await requireUserId()
  // enforceRateLimit(`diagnose:${userId}`, { limit: 30, windowMs: 60 * 60 * 1000 })

  const input = await parseJsonBody(request, diagnoseRequestSchema)
  return ok(await diagnosePlant(userId, params.id, input))
})
