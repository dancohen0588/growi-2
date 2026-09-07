import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import * as listingService from '@/lib/services/community/listing.service'

export const dynamic = 'force-dynamic'

/** Mes fils, les deux rôles confondus — l'écran « Messages ». */
export const GET = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const cursor = new URL(request.url).searchParams.get('cursor')
  return ok(await listingService.listThreads(userId, cursor))
})
