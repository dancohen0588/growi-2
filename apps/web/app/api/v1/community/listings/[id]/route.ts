import { updateListingSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { noContent, ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as listingService from '@/lib/services/community/listing.service'

export const dynamic = 'force-dynamic'

type Context = { params: { id: string } }

export const GET = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  return ok(await listingService.getListing(params.id, userId))
})

/** Texte, statut (`active` / `reserved` / `done`) et prolongation. */
export const PATCH = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, updateListingSchema)
  return ok(await listingService.updateListing(params.id, userId, input))
})

export const DELETE = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  await listingService.deleteListing(params.id, userId)
  return noContent()
})
