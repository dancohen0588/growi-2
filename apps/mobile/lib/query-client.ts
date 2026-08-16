import { QueryClient } from '@tanstack/react-query'
import { isApiError } from '@growi/api-client'

export const queryClient = new QueryClient({
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
