import { communityRadiusSchema, createListingSchema, listingCategorySchema, listingKindSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { created, ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as listingService from '@/lib/services/community/listing.service'

export const dynamic = 'force-dynamic'

/**
 * La bourse.
 *
 * Derrière le login en v1 : une annonce porte une distance relative à celui
 * qui la lit, et se déclarer intéressé suppose un compte.
 *
 * Les filtres sont lus avec indulgence — une valeur inconnue vaut « pas de
 * filtre », jamais une erreur. Même règle que les listes du portail admin.
 */
export const GET = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const params = new URL(request.url).searchParams

  const kind = listingKindSchema.safeParse(params.get('kind'))
  const category = listingCategorySchema.safeParse(params.get('category'))
  const radius = communityRadiusSchema.safeParse(Number(params.get('radiusKm')))

  return ok(
    await listingService.listListings(
      userId,
      {
        kind: kind.success ? kind.data : undefined,
        category: category.success ? category.data : undefined,
        radiusKm: radius.success ? radius.data : undefined,
      },
      params.get('cursor'),
    ),
  )
})

export const POST = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, createListingSchema)
  return created(await listingService.createListing(userId, input))
})
