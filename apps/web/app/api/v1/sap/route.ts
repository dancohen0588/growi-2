import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { serializeSapSummary } from '@/lib/api/serializers'
import { getSapOverview } from '@/lib/services/sap-rewards.service'

export const dynamic = 'force-dynamic'

/**
 * Ta sève : total, cernes, gouttes qu'il reste à offrir, derniers gains, ce
 * que les cernes ont débloqué et le thème d'Accueil choisi. Le client la relit
 * après un geste pour annoncer ce qu'il a rapporté — et c'est cette lecture
 * qui remet la récompense d'un cerne tout juste formé.
 */
export const GET = withApiErrorHandling(async () => {
  const userId = await requireUserId()
  return ok(serializeSapSummary(await getSapOverview(userId)))
})
