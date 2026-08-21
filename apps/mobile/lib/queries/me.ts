import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateAlertConfigInput, UpdateProfileInput, UserProfile } from '@growi/shared'

import { api } from '@/lib/api'
import { meKeys, planningKeys, summaryKeys } from '@/lib/queries/keys'

export function useProfile() {
  return useQuery({
    queryKey: meKeys.profile(),
    queryFn: () => api.me.get(),
  })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => api.me.update(input),
    onSuccess: (profile) => {
      queryClient.setQueryData(meKeys.profile(), profile)
      // La localisation conditionne la météo, donc le planning et ses alertes.
      void queryClient.invalidateQueries({ queryKey: planningKeys.all })
      void queryClient.invalidateQueries({ queryKey: summaryKeys.all })
    },
  })
}

/**
 * Préférences d'alertes, en écriture partielle.
 *
 * L'interrupteur bascule aussitôt : attendre le serveur pour un réglage se
 * verrait. Un échec le remet dans sa position d'avant.
 */
export function useUpdateAlerts() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateAlertConfigInput) => api.me.updateAlerts(input),

    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: meKeys.profile() })
      const previous = queryClient.getQueryData<UserProfile>(meKeys.profile())

      queryClient.setQueryData<UserProfile>(meKeys.profile(), (profile) =>
        profile ? { ...profile, alertConfig: { ...profile.alertConfig, ...input } } : profile,
      )

      return { previous }
    },

    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(meKeys.profile(), context.previous)
    },

    onSuccess: (alertConfig) => {
      queryClient.setQueryData<UserProfile>(meKeys.profile(), (profile) =>
        profile ? { ...profile, alertConfig } : profile,
      )
    },
  })
}
