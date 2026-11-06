import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { serializeSapSummary } from '@/lib/api/serializers'
import * as sapService from '@/lib/services/sap.service'

export const dynamic = 'force-dynamic'

/**
 * Ta sève : total, cernes, gouttes qu'il reste à offrir et derniers gains.
 * Le client la relit après un geste pour annoncer ce qu'il a rapporté.
 */
export const GET = withApiErrorHandling(async () => {
  const userId = await requireUserId()
  return ok(serializeSapSummary(await sapService.getSapSummary(userId)))
})
