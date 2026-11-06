import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { GiveSapDropInput, SapEntryPage, SapHomeTheme, SapSummary } from '@growi/shared'

import { api } from '@/lib/api'
import { sapKeys } from '@/lib/queries/keys'

/**
 * La sève du compte : la pastille du hero, la carte de l'Accueil, l'écran
 * « Ta sève » et `SapGainWatcher` lisent tous cette même requête.
 *
 * Elle n'est relue qu'après un geste (le watcher invalide la clé à chaque
 * mutation réussie) ou au retour dans l'app : une minute de fraîcheur évite
 * de la redemander à chaque changement d'onglet.
 */
export function useSapSummary() {
  return useQuery({
    queryKey: sapKeys.summary(),
    queryFn: () => api.sap.summary(),
    staleTime: 60 * 1000,
  })
}

/** L'historique complet des gains, par pages de vingt. */
export function useSapHistory() {
  return useInfiniteQuery({
    queryKey: sapKeys.history(),
    queryFn: ({ pageParam }) => api.sap.history({ cursor: pageParam ?? undefined }),
    initialPageParam: null as string | null,
    getNextPageParam: (last: SapEntryPage) => last.nextCursor ?? undefined,
  })
}

/**
 * Offrir une goutte. La clé de mutation (`sap`) dit au watcher de ne pas
 * relancer la lecture de son côté : on la met à jour ici, avec le nombre de
 * gouttes que rend le serveur — la sève du donneur, elle, ne bouge pas.
 */
export function useGiveSapDrop() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: [...sapKeys.all, 'give'],
    mutationFn: (input: GiveSapDropInput) => api.sap.give(input),
    onSuccess: ({ giftsLeft }) => {
      queryClient.setQueryData<SapSummary>(sapKeys.summary(), (current) =>
        current ? { ...current, giftsLeft } : current,
      )
    },
  })
}

/**
 * Choisir le thème d'Accueil. Optimiste : l'Accueil change dès le tap, et
 * revient au thème d'avant si le serveur refuse.
 */
export function useSetHomeTheme() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: [...sapKeys.all, 'theme'],
    mutationFn: (theme: SapHomeTheme | null) => api.sap.setTheme({ theme }),
    onMutate: async (theme) => {
      await queryClient.cancelQueries({ queryKey: sapKeys.summary() })
      const previous = queryClient.getQueryData<SapSummary>(sapKeys.summary())
      queryClient.setQueryData<SapSummary>(sapKeys.summary(), (current) =>
        current ? { ...current, homeTheme: theme } : current,
      )
      return { previous }
    },
    onError: (_error, _theme, context) => {
      if (context?.previous) queryClient.setQueryData(sapKeys.summary(), context.previous)
    },
  })
}
