import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { AddIdentifiedPlantInput, IdentifyApiResponse } from '@growi/shared'

import { api } from '@/lib/api'
import { gardenKeys, planningKeys, plantKeys, summaryKeys } from '@/lib/queries/keys'

/**
 * Identification par photo.
 *
 * Un appel au modèle est facturé et la route le limite à trente par heure :
 * aucune reprise automatique, l'utilisateur relance s'il le souhaite.
 */
export function useIdentifyPlant() {
  return useMutation<IdentifyApiResponse, unknown, string>({
    mutationFn: (imageBase64) => api.identify.fromPhoto(imageBase64),
    retry: false,
  })
}

/** Ajoute la plante reconnue au jardin le plus récent. */
export function useAddIdentifiedPlant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: AddIdentifiedPlantInput) => api.plants.addIdentified(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: plantKeys.all })
      void queryClient.invalidateQueries({ queryKey: gardenKeys.all })
      void queryClient.invalidateQueries({ queryKey: planningKeys.all })
      void queryClient.invalidateQueries({ queryKey: summaryKeys.all })
    },
  })
}
