import { ok, withApiErrorHandling } from '@/lib/api/response'
import { serializeBlogPost } from '@/lib/api/serializers'
import { getPostAsHtml } from '@/lib/blog/content'
import { ServiceError } from '@/lib/services/errors'
import { requestOrigin } from '@/lib/site-url'
import { BLOG_CACHE_HEADERS } from '../cache'

export const dynamic = 'force-dynamic'

type Context = { params: { slug: string } }

/**
 * Un article, contenu compris — le MDX y est compilé en **HTML**, le mobile
 * n'exécutant pas de React. Route publique, comme la liste.
 */
export const GET = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const post = await getPostAsHtml(params.slug)
  if (!post) throw new ServiceError('NOT_FOUND', 'Article introuvable')

  return ok(serializeBlogPost(post, requestOrigin(request)), { headers: BLOG_CACHE_HEADERS })
})
