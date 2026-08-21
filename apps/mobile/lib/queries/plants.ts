import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type {
  CareLog,
  CareLogType,
  CreateCareLogInput,
  PlantInstanceWithRelations,
  UpdatePlantInstanceInput,
} from '@growi/shared'

import { api } from '@/lib/api'
import { gardenKeys, planningKeys, plantKeys } from '@/lib/queries/keys'

export { plantKeys }

/** Date de la plante que chaque geste fait avancer — miroir du service serveur. */
const PLANT_DATE_FIELD: Partial<Record<CareLogType, keyof PlantInstanceWithRelations>> = {
  watering: 'lastWateredAt',
  pruning: 'lastPrunedAt',
  fertilizing: 'lastFertilizedAt',
  treatment: 'lastTreatedAt',
  repotting: 'lastRepottedAt',
}

/**
 * Toutes les plantes, tous jardins confondus — l'onglet « Mes plantes ».
 *
 * Répond à « où en est mon basilic ? » sans obliger à se souvenir du jardin
 * dans lequel il vit.
 */
export function useAllPlants() {
  return useQuery({
    queryKey: [...plantKeys.all, 'list'] as const,
    queryFn: () => api.plants.list(),
  })
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
      // La fréquence d'arrosage ou l'exposition changent les gestes du jour.
      void queryClient.invalidateQueries({ queryKey: planningKeys.all })
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

/**
 * Enregistre un geste avec mise à jour optimiste.
 *
 * Le geste doit se voir immédiatement : on inscrit le log en tête de
 * l'historique et on avance la date correspondante sur la plante avant la
 * réponse du serveur, quitte à revenir en arrière si l'appel échoue.
 *
 * Le journal unifié simplifie beaucoup cette logique : une seule liste à
 * compléter, au lieu de quatre selon le type.
 */
export function useAddCareLog(plantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: CreateCareLogInput) => api.plants.addLog(plantId, input),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: plantKeys.detail(plantId) })
      await queryClient.cancelQueries({ queryKey: plantKeys.logs(plantId) })

      const previousLogs = queryClient.getQueryData<CareLog[]>(plantKeys.logs(plantId))
      const previousPlant = queryClient.getQueryData<PlantInstanceWithRelations>(
        plantKeys.detail(plantId),
      )

      const now = input.occurredAt ?? new Date().toISOString()
      const optimistic: CareLog = {
        // Identifiant provisoire, remplacé par celui du serveur à l'invalidation.
        id: `optimistic-${now}`,
        plantInstanceId: plantId,
        type: input.type,
        occurredAt: now,
        note: input.note ?? null,
        productUsed: input.productUsed ?? null,
        status: input.status ?? null,
        quantity: input.quantity ?? null,
        unit: input.unit ?? null,
        photoUrl: input.photoUrl ?? null,
        createdAt: now,
      }

      queryClient.setQueryData<CareLog[]>(plantKeys.logs(plantId), (logs) => [
        optimistic,
        ...(logs ?? []),
      ])

      queryClient.setQueryData<PlantInstanceWithRelations>(
        plantKeys.detail(plantId),
        (plant) => {
          if (!plant) return plant
          const dateField = PLANT_DATE_FIELD[input.type]
          const next = dateField ? { ...plant, [dateField]: now } : { ...plant }
          if (input.type === 'health' && input.status) {
            next.healthStatus = input.status
            next.healthNote = input.note ?? null
          }
          return next
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
      // Le planning du jour et les listes dépendent des dates d'entretien :
      // « J'ai arrosé » doit faire tomber la tâche « Arroser ».
      void queryClient.invalidateQueries({ queryKey: gardenKeys.all })
      void queryClient.invalidateQueries({ queryKey: planningKeys.all })
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
      void queryClient.invalidateQueries({ queryKey: planningKeys.all })
    },
  })
}
