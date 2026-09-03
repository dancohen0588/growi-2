import { parcelSearchQuerySchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { formatZodError, ok, withApiErrorHandling } from '@/lib/api/response'
import { findParcelsNear } from '@/lib/services/cadastre.service'
import { ServiceError } from '@/lib/services/errors'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

/**
 * Les parcelles cadastrales les plus proches d'un point, à confirmer par
 * l'utilisateur. La route ne reçoit que des coordonnées, jamais l'adresse en
 * clair, et c'est le serveur qui appelle l'IGN.
 */
export const GET = withApiErrorHandling(async (request: Request) => {
  await requireUserId()

  const { searchParams } = new URL(request.url)
  const parsed = parcelSearchQuerySchema.safeParse({
    lat: searchParams.get('lat'),
    lon: searchParams.get('lon'),
  })
  if (!parsed.success) {
    throw new ServiceError('INVALID_INPUT', formatZodError(parsed.error))
  }

  return ok(await findParcelsNear(parsed.data.lat, parsed.data.lon))
})
