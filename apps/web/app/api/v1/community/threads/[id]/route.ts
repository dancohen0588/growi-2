import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import * as listingService from '@/lib/services/community/listing.service'

export const dynamic = 'force-dynamic'

type Context = { params: { id: string } }

/**
 * Le fil et sa première page de messages.
 *
 * **Marque la lecture au passage** : ouvrir un fil, c'est le lire, et demander
 * un second appel pour l'admettre laisserait le badge allumé sur un écran
 * qu'on a sous les yeux.
 */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  return ok(await listingService.getThread(params.id, userId))
})
