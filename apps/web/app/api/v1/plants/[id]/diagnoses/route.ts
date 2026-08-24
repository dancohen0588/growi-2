import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { listDiagnoses } from '@/lib/services/diagnosis.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

type Context = { params: { id: string } }

/** Historique des diagnostics d'une plante, du plus récent au plus ancien. */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  return ok(await listDiagnoses(userId, params.id))
})
