import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  groupActionsByHorizon,
  type ClearPlanningTodayInput,
  type GardenAction,
  type MarkActionDoneInput,
  type MarkActionsDoneBulkInput,
  type TodayPlanning,
  type UndoActionInput,
} from '@growi/shared'

import { api } from '@/lib/api'
import { diagnosisKeys, gardenKeys, planningKeys, plantKeys, summaryKeys } from '@/lib/queries/keys'

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
    /** Les gestes notés aujourd'hui — la section « Fait aujourd'hui ». */
    doneToday: data?.doneToday ?? [],
    /** Le jardin le plus récent, celui qu'on met en pause d'un tap. */
    gardenIds: data?.gardens.map((garden) => garden.id) ?? [],
    clearedToday: data?.gardens.some((garden) => garden.clearedToday) ?? false,
  }
}

/** Les quatre caches que tout geste sur le planning rend périmés. */
function invalidatePlanning(queryClient: ReturnType<typeof useQueryClient>, plantIds: string[]) {
  void queryClient.invalidateQueries({ queryKey: planningKeys.today() })
  void queryClient.invalidateQueries({ queryKey: summaryKeys.all })
  // Une tâche cochée disparaît de l'historique ouvert des diagnostics.
  void queryClient.invalidateQueries({ queryKey: diagnosisKeys.all })
  for (const plantId of plantIds) {
    void queryClient.invalidateQueries({ queryKey: plantKeys.detail(plantId) })
    void queryClient.invalidateQueries({ queryKey: plantKeys.logs(plantId) })
  }
  void queryClient.invalidateQueries({ queryKey: gardenKeys.all })
}

/** Retire des actions du planning en cache, sans attendre le serveur. */
function dropActions(
  queryClient: ReturnType<typeof useQueryClient>,
  actionIds: string[],
): TodayPlanning | undefined {
  const previous = queryClient.getQueryData<TodayPlanning>(planningKeys.today())
  const dropped = new Set(actionIds)

  queryClient.setQueryData<TodayPlanning>(planningKeys.today(), (planning) =>
    planning
      ? {
          ...planning,
          gardens: planning.gardens.map((garden) => ({
            ...garden,
            actions: garden.actions.filter((action) => !dropped.has(action.id)),
          })),
        }
      : planning,
  )

  return previous
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
        // Renseigné pour une tâche planifiée : elle s'acquitte nommément, là
        // où une action du moteur se contente du geste au journal.
        taskId: input.taskId,
      }),

    onMutate: async ({ actionId }) => {
      await queryClient.cancelQueries({ queryKey: planningKeys.today() })
      return { previous: dropActions(queryClient, [actionId]) }
    },

    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(planningKeys.today(), context.previous)
      }
    },

    // Le geste noté apparaît aussi dans l'historique de la plante.
    onSettled: (_data, _error, { plantId }) =>
      invalidatePlanning(queryClient, plantId ? [plantId] : []),
  })
}

/**
 * Coche plusieurs actions d'un coup — « Tout arrosé », « Tout marquer fait ».
 *
 * Un appel et une seule invalidation, là où N mutations unitaires
 * rechargeaient le planning N fois : sur cinq plantes, la liste sautait cinq
 * fois sous le doigt.
 */
export function useMarkActionsDoneBulk() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: MarkActionsDoneBulkInput & { actionIds: string[] }) =>
      api.planning.markDoneBulk({ gardenId: input.gardenId, items: input.items }),

    onMutate: async ({ actionIds }) => {
      await queryClient.cancelQueries({ queryKey: planningKeys.today() })
      return { previous: dropActions(queryClient, actionIds) }
    },

    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData(planningKeys.today(), context.previous)
      }
    },

    onSettled: (_data, _error, { items }) =>
      invalidatePlanning(
        queryClient,
        items.map((item) => item.plantId).filter((id): id is string => !!id),
      ),
  })
}

/**
 * « Ignorer pour aujourd'hui », et son « Rétablir ».
 *
 * Aucune mise à jour optimiste : le serveur décide de ce qui reste — les
 * tâches issues d'un diagnostic ne sont jamais masquées, et refaire ce tri
 * côté client serait s'exposer à ce que les deux divergent.
 */
export function useClearToday() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: ClearPlanningTodayInput & { gardenIds?: string[] }) => {
      const gardens = input.gardenIds ?? [input.gardenId]
      for (const gardenId of gardens) {
        await api.planning.clearToday({ gardenId, undo: input.undo })
      }
    },
    onSettled: () => invalidatePlanning(queryClient, []),
  })
}

/**
 * Annule un geste : le journal, la date de la plante et la tâche reviennent.
 *
 * L'action qui revient au planning est celle que le moteur recalcule, pas
 * celle qu'on aurait devinée : on invalide plutôt que de la réinsérer.
 */
export function useUndoAction() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UndoActionInput & { plantId?: string }) =>
      api.planning.undo({
        gardenId: input.gardenId,
        careLogId: input.careLogId,
        taskId: input.taskId,
      }),

    onSettled: (_data, _error, { plantId }) =>
      invalidatePlanning(queryClient, plantId ? [plantId] : []),
  })
}
