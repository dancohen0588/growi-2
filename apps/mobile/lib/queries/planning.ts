import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { MarkActionDoneInput, TodayPlanning } from '@growi/shared'

import { api } from '@/lib/api'
import { gardenKeys } from '@/lib/queries/gardens'
import { plantKeys } from '@/lib/queries/plants'

export const planningKeys = {
  all: ['planning'] as const,
  today: () => [...planningKeys.all, 'today'] as const,
}

/**
 * Le planning du jour.
 *
 * Il vieillit vite — la météo change, les tâches se cochent — mais il est
 * coûteux à recalculer côté serveur : cinq minutes de fraîcheur évitent de le
 * redemander à chaque retour sur l'onglet.
 */
export function useTodayPlanning() {
  return useQuery({
    queryKey: planningKeys.today(),
    queryFn: () => api.planning.today(),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * Coche une tâche, avec mise à jour optimiste.
 *
 * La ligne disparaît sous le doigt : attendre l'aller-retour serveur pour une
 * case à cocher se verrait. En cas d'échec elle revient, et le toast d'erreur
 * explique pourquoi.
 */
export function useMarkActionDone() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: MarkActionDoneInput & { actionId: string }) =>
      api.planning.markDone({
        gardenId: input.gardenId,
        actionType: input.actionType,
        plantId: input.plantId,
      }),

    onMutate: async ({ actionId }) => {
      await queryClient.cancelQueries({ queryKey: planningKeys.today() })
      const previous = queryClient.getQueryData<TodayPlanning>(planningKeys.today())

      queryClient.setQueryData<TodayPlanning>(planningKeys.today(), (planning) =>
        planning
          ? {
              ...planning,
              gardens: planning.gardens.map((garden) => ({
                ...garden,
                actions: garden.actions.filter((action) => action.id !== actionId),
              })),
            }
          : planning,
      )

      return { previous }
    },

    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(planningKeys.today(), context.previous)
      }
    },

    onSettled: (_data, _error, { plantId }) => {
      void queryClient.invalidateQueries({ queryKey: planningKeys.today() })
      // Le geste noté apparaît aussi dans l'historique de la plante.
      if (plantId) {
        void queryClient.invalidateQueries({ queryKey: plantKeys.detail(plantId) })
        void queryClient.invalidateQueries({ queryKey: plantKeys.logs(plantId) })
      }
      void queryClient.invalidateQueries({ queryKey: gardenKeys.all })
    },
  })
}
