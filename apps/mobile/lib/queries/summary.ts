import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { summaryKeys } from '@/lib/queries/keys'

/**
 * Les indicateurs de l'accueil.
 *
 * Ils se déduisent du planning, déjà mis en cache six heures côté serveur :
 * deux minutes de fraîcheur suffisent ici, le temps qu'un geste coché se
 * répercute au retour sur l'écran.
 */
export function useSummary() {
  return useQuery({
    queryKey: summaryKeys.all,
    queryFn: () => api.summary.get(),
    staleTime: 2 * 60 * 1000,
  })
}
