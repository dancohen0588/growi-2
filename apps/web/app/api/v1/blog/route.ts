import { blogListQuerySchema } from '@growi/shared'

import { ok, withApiErrorHandling } from '@/lib/api/response'
import { serializeBlogListResponse } from '@/lib/api/serializers'
import { listPosts } from '@/lib/blog/content'
import { requestOrigin } from '@/lib/site-url'
import { BLOG_CACHE_HEADERS } from './cache'

// La liste dépend de la query string : jamais de rendu statique. La mise en
// cache est assurée par les en-têtes ci-dessous, pas par le rendu.
export const dynamic = 'force-dynamic'

/**
 * Liste paginée des articles, pour le mobile.
 *
 * Route **publique** : contrairement au reste de l'API v1, elle n'exige aucun
 * jeton — le blog est déjà lisible par tous sur le site.
 */
export const GET = withApiErrorHandling(async (request: Request) => {
  const { searchParams } = new URL(request.url)

  const query = blogListQuerySchema.parse({
    page: searchParams.get('page') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    tag: searchParams.get('tag') ?? undefined,
  })

  return ok(serializeBlogListResponse(listPosts(query), requestOrigin(request)), {
    headers: BLOG_CACHE_HEADERS,
  })
})
