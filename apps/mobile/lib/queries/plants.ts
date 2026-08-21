import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdatePlantInstanceInput } from '@growi/shared'

import { api } from '@/lib/api'
import { gardenKeys } from '@/lib/queries/gardens'

export const plantKeys = {
  all: ['plants'] as const,
  detail: (plantId: string) => [...plantKeys.all, 'detail', plantId] as const,
  logs: (plantId: string) => [...plantKeys.all, 'detail', plantId, 'logs'] as const,
}

export function usePlant(plantId: string) {
  return useQuery({
    queryKey: plantKeys.detail(plantId),
    queryFn: () => api.plants.get(plantId),
    enabled: Boolean(plantId),
  })
}

export function useUpdatePlant(plantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdatePlantInstanceInput) => api.plants.update(plantId, input),
    onSuccess: (plant) => {
      queryClient.setQueryData(plantKeys.detail(plantId), plant)
      // La liste du jardin affiche le nom et l'emoji : elle doit suivre.
      void queryClient.invalidateQueries({ queryKey: gardenKeys.all })
    },
  })
}

export function useDeletePlant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (plantId: string) => api.plants.remove(plantId),
    onSuccess: (_data, plantId) => {
      queryClient.removeQueries({ queryKey: plantKeys.detail(plantId) })
      void queryClient.invalidateQueries({ queryKey: gardenKeys.all })
    },
  })
}
