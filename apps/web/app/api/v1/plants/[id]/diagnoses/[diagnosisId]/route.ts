import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { getDiagnosis } from '@/lib/services/diagnosis.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

type Context = { params: { id: string; diagnosisId: string } }

/** Un diagnostic complet — observations, causes et recommandations. */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  return ok(await getDiagnosis(userId, params.id, params.diagnosisId))
})
