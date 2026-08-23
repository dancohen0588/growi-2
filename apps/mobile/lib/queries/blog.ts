import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type { BlogListResponse, BlogTag } from '@growi/shared'

import { api } from '@/lib/api'
import { blogKeys } from '@/lib/queries/keys'

export { blogKeys }

/**
 * Le blog ne bouge qu'au déploiement du site : une heure de fraîcheur évite de
 * le redemander à chaque passage sur l'accueil, sans jamais servir un contenu
 * réellement périmé.
 */
const STALE_TIME = 60 * 60 * 1000

/** Articles par page de la liste. */
const PAGE_SIZE = 10

/** Articles montrés dans le carrousel de l'accueil. */
export const HOME_POST_COUNT = 5

/**
 * La liste des articles, en pagination infinie.
 *
 * `pagination.next` porte déjà le numéro de la page suivante, ou `null` sur la
 * dernière : `getNextPageParam` n'a rien à recalculer.
 */
export function useBlogPosts(tag?: BlogTag) {
  return useInfiniteQuery({
    queryKey: blogKeys.list(tag),
    queryFn: ({ pageParam }) => api.blog.list({ page: pageParam, limit: PAGE_SIZE, tag }),
    initialPageParam: 1,
    getNextPageParam: (last: BlogListResponse) => last.pagination.next ?? undefined,
    staleTime: STALE_TIME,
  })
}

/**
 * Les derniers articles, pour le carrousel de l'accueil.
 *
 * Requête distincte de la liste : elle ne demande que cinq articles, et
 * l'accueil n'a pas à porter le cache de la pagination complète.
 */
export function useLatestBlogPosts() {
  return useQuery({
    queryKey: [...blogKeys.all, 'latest'] as const,
    queryFn: () => api.blog.list({ limit: HOME_POST_COUNT }),
    select: (response: BlogListResponse) => response.posts,
    staleTime: STALE_TIME,
  })
}

/** Un article, contenu compris. */
export function useBlogPost(slug: string) {
  return useQuery({
    queryKey: blogKeys.detail(slug),
    queryFn: () => api.blog.get(slug),
    staleTime: STALE_TIME,
    enabled: slug.length > 0,
  })
}
