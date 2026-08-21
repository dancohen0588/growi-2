import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { getDashboardSummary } from '@/lib/services/summary.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

/** Les indicateurs de l'accueil : jardins, plantes, gestes du jour, alertes. */
export const GET = withApiErrorHandling(async () => {
  const userId = await requireUserId()
  return ok(await getDashboardSummary(userId))
})
