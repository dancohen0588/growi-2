import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Grimoire, SecretFeedbackInput } from '@growi/shared'

import { api } from '@/lib/api'
import { planningKeys, secretKeys } from '@/lib/queries/keys'
import { dropActions, invalidatePlanning } from '@/lib/queries/planning'

/**
 * Secrets de jardinier — dévoilement, refus, retour d'expérience, grimoire.
 *
 * « Je tente » met le secret à faire (`useTrySecret`) : il revient au
 * planning en tâche, et c'est en la cochant que l'essai s'inscrit au journal.
 * « C'est fait » d'une préparation est un geste du planning
 * (`useMarkActionDone` avec `tipSlug`).
 */

export function useGrimoire() {
  return useQuery({
    queryKey: secretKeys.grimoire(),
    queryFn: () => api.secrets.grimoire(),
    staleTime: 60 * 1000,
  })
}

/**
 * La progression du grimoire (« 3 / 24 ») **si elle est déjà en cache** —
 * jamais de requête : la carte du secret vit sur l'Accueil et le Calendrier,
 * et y demander le grimoire ajouterait un appel à chaque ouverture pour un
 * simple compteur. Désactivée, la requête n'est pas non plus relancée par les
 * invalidations ; elle suit le cache dès que l'écran du grimoire l'a rempli.
 */
export function useCachedGrimoireProgress(): { discovered: number; total: number } | null {
  const { data } = useQuery({
    queryKey: secretKeys.grimoire(),
    queryFn: () => api.secrets.grimoire(),
    enabled: false,
    select: (grimoire: Grimoire) => ({ discovered: grimoire.discovered, total: grimoire.total }),
  })
  return data ?? null
}

/**
 * Le secret a été dévoilé : il entre au grimoire. Idempotent côté serveur,
 * donc sans état à surveiller — un échec ne gêne pas la lecture, et la
 * prochaine ouverture le retentera.
 */
export function useRevealSecret() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (slug: string) => api.secrets.reveal(slug),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: secretKeys.all }),
  })
}

/**
 * « Pas pour moi ». La carte disparaît sous le doigt ; un échec la ramène.
 */
export function useDismissSecret() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { slug: string; actionId: string }) => api.secrets.dismiss(input.slug),

    onMutate: async ({ actionId }) => {
      await queryClient.cancelQueries({ queryKey: planningKeys.today() })
      return { previous: dropActions(queryClient, [actionId]) }
    },

    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(planningKeys.today(), context.previous)
    },

    onSettled: () => {
      invalidatePlanning(queryClient, [])
      void queryClient.invalidateQueries({ queryKey: secretKeys.all })
    },
  })
}

/**
 * « Je tente » : le secret s'ajoute au calendrier en tâche à faire. La carte
 * disparaît sous le doigt ; la tâche arrive au rechargement du planning.
 */
export function useTrySecret() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { slug: string; actionId: string; gardenId: string; plantId: string }) =>
      api.secrets.try(input.slug, { gardenId: input.gardenId, plantId: input.plantId }),

    onMutate: async ({ actionId }) => {
      await queryClient.cancelQueries({ queryKey: planningKeys.today() })
      return { previous: dropActions(queryClient, [actionId]) }
    },

    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(planningKeys.today(), context.previous)
    },

    onSettled: (_data, _error, { plantId }) => invalidatePlanning(queryClient, [plantId]),
  })
}

/** Patch optimiste d'une entrée du grimoire. */
function patchEntry(
  queryClient: ReturnType<typeof useQueryClient>,
  slug: string,
  patch: Partial<Grimoire['entries'][number]>,
): Grimoire | undefined {
  const previous = queryClient.getQueryData<Grimoire>(secretKeys.grimoire())
  queryClient.setQueryData<Grimoire>(secretKeys.grimoire(), (grimoire) =>
    grimoire
      ? {
          ...grimoire,
          entries: grimoire.entries.map((entry) =>
            entry.slug === slug ? { ...entry, ...patch } : entry,
          ),
        }
      : grimoire,
  )
  return previous
}

/** « Me le reproposer », depuis le grimoire. */
export function useRestoreSecret() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (slug: string) => api.secrets.restore(slug),

    onMutate: async (slug) => {
      await queryClient.cancelQueries({ queryKey: secretKeys.grimoire() })
      return { previous: patchEntry(queryClient, slug, { dismissed: false }) }
    },

    onError: (_error, _slug, context) => {
      if (context?.previous) queryClient.setQueryData(secretKeys.grimoire(), context.previous)
    },

    // Revenu dans la rotation, il peut redevenir le secret de la semaine.
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: secretKeys.all })
      invalidatePlanning(queryClient, [])
    },
  })
}

/** « Ça a marché ? » — la carte s'en va dès le verdict choisi. */
export function useSecretFeedback() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: SecretFeedbackInput & { actionId: string; plantId?: string }) =>
      api.secrets.feedback({ careLogId: input.careLogId, verdict: input.verdict }),

    onMutate: async ({ actionId }) => {
      await queryClient.cancelQueries({ queryKey: planningKeys.today() })
      return { previous: dropActions(queryClient, [actionId]) }
    },

    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(planningKeys.today(), context.previous)
    },

    onSettled: (_data, _error, { plantId }) => {
      invalidatePlanning(queryClient, plantId ? [plantId] : [])
      void queryClient.invalidateQueries({ queryKey: secretKeys.all })
    },
  })
}
