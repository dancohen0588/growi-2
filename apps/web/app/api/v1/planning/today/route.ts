import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { getTodayPlanning } from '@/lib/services/planning.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

/** Écran d'accueil du mobile : tâches du jour, alertes et météo locale. */
export const GET = withApiErrorHandling(async () => {
  const userId = await requireUserId()
  return ok(await getTodayPlanning(userId))
})
