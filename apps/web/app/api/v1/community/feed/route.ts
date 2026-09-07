import { communityRadiusSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import * as postService from '@/lib/services/community/post.service'

export const dynamic = 'force-dynamic'

/**
 * Le fil « Autour de moi ».
 *
 * Authentifié sans exception : le fil est centré sur la position de celui qui
 * le lit, il n'a donc pas de version anonyme.
 *
 * `radiusKm` est facultatif — sans lui, on prend le rayon enregistré dans les
 * réglages. Une valeur hors des trois paliers est ignorée plutôt que refusée :
 * un paramètre d'URL absurde doit ramener le fil habituel, pas une erreur.
 */
export const GET = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const params = new URL(request.url).searchParams

  const radius = communityRadiusSchema.safeParse(Number(params.get('radiusKm')))

  return ok(
    await postService.getNearbyFeed(
      userId,
      radius.success ? radius.data : null,
      params.get('cursor'),
    ),
  )
})
