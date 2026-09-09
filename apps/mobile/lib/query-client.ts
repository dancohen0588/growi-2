import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { isApiError } from '@growi/api-client'

import { reportError } from '@/lib/observability/report'

/**
 * Presque tout ce que l'app demande à l'API passe par React Query : ses deux
 * caches sont donc le point unique où remonter une erreur inattendue, plutôt
 * que trente-sept `catch` qui afficheraient chacun un toast sans rien dire à
 * personne. `reportError` écarte lui-même les erreurs attendues.
 */
export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      reportError(error, { operation: `query:${String(query.queryKey[0] ?? 'inconnue')}` })
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      reportError(error, {
        operation: `mutation:${String(mutation.options.mutationKey?.[0] ?? 'inconnue')}`,
      })
    },
  }),
  defaultOptions: {
    queries: {
      // En mobile, la connexion est souvent instable : on garde les données
      // affichées plutôt que de vider l'écran à chaque aller-retour.
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        // Inutile de réessayer ce qui ne peut pas réussir : jeton refusé,
        // ressource absente, corps invalide.
        if (isApiError(error) && !error.isNetworkError && !error.isServerError) {
          return false
        }
        return failureCount < 2
      },
    },
    mutations: {
      retry: false,
    },
  },
})
