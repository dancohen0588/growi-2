import { communityRadiusSchema, feedScopeSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import * as postService from '@/lib/services/community/post.service'

export const dynamic = 'force-dynamic'

/**
 * Les deux fils : « Autour de moi » (défaut) et « Abonnements ».
 *
 * Authentifié sans exception : l'un est centré sur la position de celui qui le
 * lit, l'autre sur ses abonnements. Ni l'un ni l'autre n'a de version anonyme.
 *
 * `scope` et `radiusKm` sont facultatifs, et une valeur inconnue est **ignorée
 * plutôt que refusée** : un paramètre d'URL absurde doit ramener le fil
 * habituel, pas une erreur au milieu d'un défilement.
 */
export const GET = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const params = new URL(request.url).searchParams

  const scope = feedScopeSchema.safeParse(params.get('scope'))
  const radius = communityRadiusSchema.safeParse(Number(params.get('radiusKm')))

  return ok(
    await postService.getFeed(
      userId,
      scope.success ? scope.data : 'nearby',
      radius.success ? radius.data : null,
      params.get('cursor'),
    ),
  )
})
