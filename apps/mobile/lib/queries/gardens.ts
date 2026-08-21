import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CreateGardenInput,
  CreatePlantInstanceInput,
  UpdateGardenInput,
} from '@growi/shared'

import { api } from '@/lib/api'
import { gardenKeys, planningKeys, summaryKeys } from '@/lib/queries/keys'

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

export function useDeletePlant(gardenId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (plantId: string) => api.plants.remove(plantId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gardenKeys.all })
      void queryClient.invalidateQueries({ queryKey: planningKeys.all })
      void queryClient.invalidateQueries({ queryKey: summaryKeys.all })
    },
  })
}
