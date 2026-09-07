import { requireUserId } from '@/lib/api/auth-context'
import { created, withApiErrorHandling } from '@/lib/api/response'
import * as listingService from '@/lib/services/community/listing.service'

export const dynamic = 'force-dynamic'

type Context = { params: { id: string } }

/**
 * « Je suis intéressé » — ouvre le fil, ou rouvre le sien.
 *
 * 201 dans les deux cas : rappeler son intérêt sur une annonce où l'on s'est
 * déjà manifesté ramène le fil existant, ce que le client traite pareil —
 * il l'ouvre.
 */
export const POST = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  return created(await listingService.expressInterest(params.id, userId))
})
