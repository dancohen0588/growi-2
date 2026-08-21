import { keepPreviousData, useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'

/** En deçà, la recherche renverrait trop de résultats pour être utile. */
export const CATALOG_MIN_QUERY_LENGTH = 2

export function useCatalogSearch(query: string) {
  const trimmed = query.trim()

  return useQuery({
    queryKey: ['catalog', 'search', trimmed],
    queryFn: () => api.catalog.search(trimmed),
    enabled: trimmed.length >= CATALOG_MIN_QUERY_LENGTH,
    // Garde les résultats précédents pendant la frappe : la liste ne
    // disparaît pas entre deux caractères.
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
  })
}
