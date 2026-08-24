import { applyDiagnosisSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { applyDiagnosisStatus } from '@/lib/services/diagnosis.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

type Context = { params: { id: string; diagnosisId: string } }

/**
 * Applique à la plante l'état de santé proposé par un diagnostic.
 *
 * C'est le seul chemin par lequel un diagnostic modifie la fiche : le corps
 * `{ apply: true }` matérialise l'accord de l'utilisateur, jamais une décision
 * du modèle. Un geste de journal `health` est noté au passage.
 */
export const POST = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const userId = await requireUserId()
  await parseJsonBody(request, applyDiagnosisSchema)

  return ok(await applyDiagnosisStatus(userId, params.id, params.diagnosisId))
})
