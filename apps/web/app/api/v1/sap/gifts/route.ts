import { giveSapDropSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { created, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as sapService from '@/lib/services/sap.service'

export const dynamic = 'force-dynamic'

/**
 * Offrir une goutte de sève à un voisin, désigné par son pseudo. 201
 * `{ giftsLeft }` ; 403 sans profil public, 404 pour un profil injoignable,
 * 429 `QUOTA_EXCEEDED` une fois les trois gouttes de la semaine offertes.
 */
export const POST = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, giveSapDropSchema)
  return created(await sapService.giveSapDrop(userId, input))
})
