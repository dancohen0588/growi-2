import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  groupActionsByHorizon,
  type GardenAction,
  type MarkActionDoneInput,
  type TodayPlanning,
} from '@growi/shared'

import { api } from '@/lib/api'
import { gardenKeys, planningKeys, plantKeys } from '@/lib/queries/keys'

export { planningKeys }

/**
 * Le planning du jour.
 *
 * Il vieillit vite — la météo change, les tâches se cochent — mais il est
 * coûteux à recalculer côté serveur : cinq minutes de fraîcheur évitent de le
 * redemander à chaque retour sur l'onglet.
 */
const todayQuery = {
  queryKey: planningKeys.today(),
  queryFn: () => api.planning.today(),
  staleTime: 5 * 60 * 1000,
}

export function useTodayPlanning() {
  return useQuery(todayQuery)
}

/**
 * Les tâches du jour visant une plante précise.
 *
 * Même requête, même cache que le calendrier : la fiche plante montre
 * exactement ce qu'il annonce, sans second aller-retour.
 */
export function usePlantActions(plantId: string) {
  return useQuery({
    ...todayQuery,
    select: (planning: TodayPlanning) =>
      planning.gardens.flatMap((garden) => garden.actions).filter((a) => a.plantId === plantId),
  })
}

/** Une tâche accompagnée du jardin dont elle vient — nécessaire pour la valider. */
export interface PlanningTask {
  action: GardenAction
  gardenId: string
  gardenName: string
  dueDate: string
}

/**
 * Le planning, rangé par échéance et prêt à afficher.
 *
 * L'accueil n'en montre que le jour même, le calendrier les trois horizons :
 * ils partagent ce découpage pour ne pas pouvoir se contredire.
 */
export function usePlanningTasks() {
  const query = useTodayPlanning()
  const data = query.data

  const tasks: PlanningTask[] =
    data?.gardens.flatMap((garden) =>
      garden.actions.map((action) => ({
        action,
        gardenId: garden.id,
        gardenName: garden.name,
        dueDate: action.dueDate,
      })),
    ) ?? []

  return {
    query,
    date: data?.date,
    weather: data?.weather ?? null,
    alerts: data?.gardens.flatMap((garden) => garden.alerts) ?? [],
    hasGarden: (data?.gardens.length ?? 0) > 0,
    // Le nom du jardin ne distingue rien quand il n'y en a qu'un.
    showGardenNames: (data?.gardens.length ?? 0) > 1,
    total: tasks.length,
    groups: groupActionsByHorizon(tasks, data?.date),
  }
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
