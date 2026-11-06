import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { serializeSapEntry } from '@/lib/api/serializers'
import * as sapService from '@/lib/services/sap.service'

export const dynamic = 'force-dynamic'

/** L'historique des gains, du plus récent au plus ancien, par curseur (`?cursor=`). */
export const GET = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const cursor = new URL(request.url).searchParams.get('cursor')
  const page = await sapService.listSapHistory(userId, cursor)
  return ok({ items: page.items.map(serializeSapEntry), nextCursor: page.nextCursor })
})
