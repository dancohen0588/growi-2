import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isApiError } from '@growi/api-client'
import type {
  CreateGardenInput,
  CreatePlantInstanceInput,
  UpdateGardenInput,
} from '@growi/shared'

import { api } from '@/lib/api'
import { gardenKeys, planningKeys, plantKeys, summaryKeys } from '@/lib/queries/keys'

export { gardenKeys }

export function useGardens() {
  return useQuery({
    queryKey: gardenKeys.list(),
    queryFn: () => api.gardens.list(),
  })
}

export function useGarden(gardenId: string) {
  return useQuery({
    queryKey: gardenKeys.detail(gardenId),
    queryFn: () => api.gardens.get(gardenId),
    enabled: Boolean(gardenId),
  })
}

export function useGardenPlants(gardenId: string) {
  return useQuery({
    queryKey: gardenKeys.plants(gardenId),
    queryFn: () => api.gardens.listPlants(gardenId),
    enabled: Boolean(gardenId),
  })
}

/**
 * Le plan dessiné du jardin.
 *
 * Requête à part de la fiche : le SVG pèse quelques dizaines de kilo-octets
 * et ne bouge qu'à l'édition, qui se fait sur ordinateur. Une demi-heure de
 * fraîcheur évite de le retélécharger à chaque aller-retour dans la pile.
 *
 * Un 404 signifie « pas encore de plan » autant que « jardin inconnu » : dans
 * les deux cas il n'y a rien à montrer, donc rien à réessayer.
 */
export function useGardenPlan(gardenId: string) {
  return useQuery({
    queryKey: gardenKeys.plan(gardenId),
    queryFn: () => api.gardens.plan(gardenId),
    enabled: Boolean(gardenId),
    staleTime: 30 * 60 * 1000,
    retry: (failureCount, error) => !(isApiError(error) && error.isNotFound) && failureCount < 2,
  })
}

export function useCreateGarden() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateGardenInput) => api.gardens.create(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gardenKeys.all })
      // Le nombre de jardins figure parmi les indicateurs de l'accueil.
      void queryClient.invalidateQueries({ queryKey: summaryKeys.all })
      void queryClient.invalidateQueries({ queryKey: planningKeys.all })
    },
  })
}

export function useUpdateGarden(gardenId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateGardenInput) => api.gardens.update(gardenId, input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gardenKeys.all })
      // Le nombre de jardins figure parmi les indicateurs de l'accueil.
      void queryClient.invalidateQueries({ queryKey: summaryKeys.all })
      void queryClient.invalidateQueries({ queryKey: planningKeys.all })
    },
  })
}

export function useDeleteGarden() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (gardenId: string) => api.gardens.remove(gardenId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gardenKeys.all })
      // Les plantes du jardin s'en vont avec lui : l'onglet « Mes plantes »
      // afficherait sinon des fiches qui n'existent plus.
      void queryClient.invalidateQueries({ queryKey: plantKeys.all })
      // Le nombre de jardins figure parmi les indicateurs de l'accueil.
      void queryClient.invalidateQueries({ queryKey: summaryKeys.all })
      void queryClient.invalidateQueries({ queryKey: planningKeys.all })
    },
  })
}

export function useAddPlant(gardenId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreatePlantInstanceInput) => api.gardens.addPlant(gardenId, input),
    onSuccess: () => {
      // Le compteur de plantes de la liste change aussi : on invalide large.
      void queryClient.invalidateQueries({ queryKey: gardenKeys.all })
      // Une plante qui arrive amène ses propres gestes du jour.
      void queryClient.invalidateQueries({ queryKey: planningKeys.all })
      void queryClient.invalidateQueries({ queryKey: summaryKeys.all })
    },
  })
}
