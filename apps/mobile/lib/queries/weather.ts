import { useQuery } from '@tanstack/react-query'

import { api } from '@/lib/api'
import { weatherKeys } from '@/lib/queries/keys'

/**
 * La météo du jardin.
 *
 * Open-Meteo est mis en cache une demi-heure côté serveur ; on s'aligne, sans
 * réessayer en cas d'échec : une absence de position renvoie une erreur
 * définitive, que l'écran traduit en invitation à la renseigner.
 */
export function useGardenWeather() {
  return useQuery({
    queryKey: weatherKeys.all,
    queryFn: () => api.weather.get(),
    staleTime: 30 * 60 * 1000,
    retry: false,
  })
}
