import { useCallback } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import type { PlantCatalog } from '@growi/shared'

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

/**
 * Retrouve la fiche complète d'une espèce reconnue en photo.
 *
 * Le rapprochement avec l'encyclopédie est fait par le serveur, qui renvoie un
 * `encyclopediaSlug` : on ne se fie qu'à lui, jamais à une ressemblance de
 * noms — relier une plante à la mauvaise fiche lui donnerait un rythme
 * d'arrosage qui n'est pas le sien. Passe par le cache de `useCatalogSearch`,
 * qui porte les mêmes clés.
 */
export function useCatalogEntryLookup() {
  const queryClient = useQueryClient()

  return useCallback(
    async (slug: string, query: string): Promise<PlantCatalog | null> => {
      const trimmed = query.trim()
      if (trimmed.length < CATALOG_MIN_QUERY_LENGTH) return null

      try {
        const results = await queryClient.fetchQuery({
          queryKey: ['catalog', 'search', trimmed],
          queryFn: () => api.catalog.search(trimmed),
          staleTime: 5 * 60_000,
        })
        return results.find((plant) => plant.slug === slug) ?? null
      } catch {
        // Sans fiche catalogue on bascule en saisie libre : c'est un
        // préremplissage en moins, pas un parcours interrompu.
        return null
      }
    },
    [queryClient],
  )
}
