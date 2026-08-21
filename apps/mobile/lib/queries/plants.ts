import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CareLogs,
  CreateCareLogInput,
  PlantInstanceWithRelations,
  UpdatePlantInstanceInput,
} from '@growi/shared'

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

export function usePlantLogs(plantId: string) {
  return useQuery({
    queryKey: plantKeys.logs(plantId),
    queryFn: () => api.plants.listLogs(plantId),
    enabled: Boolean(plantId),
  })
}

const EMPTY_LOGS: CareLogs = { watering: [], pruning: [], fertilizing: [], health: [] }

/**
 * Enregistre une intervention avec mise à jour optimiste.
 *
 * Le geste « J'ai arrosé » doit se voir immédiatement : on inscrit le log et
 * on avance la date correspondante sur la plante avant même la réponse du
 * serveur, quitte à revenir en arrière si l'appel échoue.
 */
export function useAddCareLog(plantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateCareLogInput) => api.plants.addLog(plantId, input),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: plantKeys.detail(plantId) })
      await queryClient.cancelQueries({ queryKey: plantKeys.logs(plantId) })

      const previousLogs = queryClient.getQueryData<CareLogs>(plantKeys.logs(plantId))
      const previousPlant = queryClient.getQueryData<PlantInstanceWithRelations>(
        plantKeys.detail(plantId),
      )

      const now = new Date().toISOString()
      // Identifiant provisoire : remplacé par celui du serveur à l'invalidation.
      const optimisticId = `optimistic-${now}`

      queryClient.setQueryData<CareLogs>(plantKeys.logs(plantId), (current) => {
        const logs = current ?? EMPTY_LOGS
        const base = { id: optimisticId, plantInstanceId: plantId, note: input.note ?? null }

        switch (input.type) {
          case 'watering':
            return { ...logs, watering: [{ ...base, wateredAt: now }, ...logs.watering] }
          case 'pruning':
            return {
              ...logs,
              pruning: [
                { ...base, prunedAt: now, pruningType: input.pruningType ?? null },
                ...logs.pruning,
              ],
            }
          case 'fertilizing':
            return {
              ...logs,
              fertilizing: [
                { ...base, fertilizedAt: now, productUsed: input.productUsed ?? null },
                ...logs.fertilizing,
              ],
            }
          case 'health':
            return {
              ...logs,
              health: [
                { ...base, loggedAt: now, status: input.status, photoUrl: null },
                ...logs.health,
              ],
            }
        }
      })

      queryClient.setQueryData<PlantInstanceWithRelations>(
        plantKeys.detail(plantId),
        (plant) => {
          if (!plant) return plant
          switch (input.type) {
            case 'watering':
              return { ...plant, lastWateredAt: now }
            case 'pruning':
              return { ...plant, lastPrunedAt: now }
            case 'fertilizing':
              return { ...plant, lastFertilizedAt: now }
            case 'health':
              return { ...plant, healthStatus: input.status, healthNote: input.note ?? null }
          }
        },
      )

      return { previousLogs, previousPlant }
    },

    onError: (_error, _input, context) => {
      // Retour à l'état d'avant : l'utilisateur voit que le geste n'a pas pris.
      if (context?.previousLogs) {
        queryClient.setQueryData(plantKeys.logs(plantId), context.previousLogs)
      }
      if (context?.previousPlant) {
        queryClient.setQueryData(plantKeys.detail(plantId), context.previousPlant)
      }
    },

    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: plantKeys.detail(plantId) })
      void queryClient.invalidateQueries({ queryKey: plantKeys.logs(plantId) })
      // Le planning du jour et les listes dépendent des dates d'entretien.
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
