import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import * as listingService from '@/lib/services/community/listing.service'

export const dynamic = 'force-dynamic'

/**
 * Mes annonces, tous statuts sauf supprimées.
 *
 * Route à part de `/listings` plutôt qu'un filtre : la bourse est
 * géographique et ne montre que l'actif, alors qu'on doit retrouver ses
 * propres annonces expirées pour les prolonger.
 */
export const GET = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const cursor = new URL(request.url).searchParams.get('cursor')
  return ok(await listingService.listMyListings(userId, cursor))
})
