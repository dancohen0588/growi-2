import { sendListingMessageSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { created, ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as listingService from '@/lib/services/community/listing.service'

export const dynamic = 'force-dynamic'

type Context = { params: { id: string } }

/** Les messages, du plus récent au plus ancien. */
export const GET = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const userId = await requireUserId()
  const cursor = new URL(request.url).searchParams.get('cursor')
  return ok(await listingService.listMessages(params.id, userId, cursor))
})

export const POST = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, sendListingMessageSchema)
  return created(await listingService.sendMessage(params.id, userId, input))
})
