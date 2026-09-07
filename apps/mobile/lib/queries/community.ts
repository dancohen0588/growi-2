import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { UpdateCommunitySettingsInput } from '@growi/shared'
import { HANDLE_MIN_LENGTH } from '@growi/shared'

import { api } from '@/lib/api'
import { communityKeys } from '@/lib/queries/keys'

/**
 * Communauté — phase 0 : réglages du profil public, profils, abonnements,
 * blocage, signalement.
 */

export function useCommunitySettings(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: communityKeys.settings(),
    queryFn: () => api.community.getSettings(),
    enabled: options?.enabled ?? true,
  })
}

export function useUpdateCommunitySettings() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UpdateCommunitySettingsInput) => api.community.updateSettings(input),
    onSuccess: (settings) => {
      queryClient.setQueryData(communityKeys.settings(), settings)
      // Changer de pseudo ou quitter la communauté change ce que les autres
      // voient de nous : les profils en cache ne valent plus rien.
      void queryClient.invalidateQueries({ queryKey: communityKeys.all })
    },
  })
}

/**
 * Disponibilité d'un pseudo, interrogée à la frappe.
 *
 * La valeur doit arriver **déjà débouncée** (`useDebouncedValue`) : ce hook ne
 * temporise pas, il se contente de ne rien demander tant que la saisie est
 * trop courte pour être valide.
 */
export function useHandleAvailability(handle: string) {
  const trimmed = handle.trim().toLowerCase()

  return useQuery({
    queryKey: communityKeys.handleCheck(trimmed),
    queryFn: () => api.community.checkHandle(trimmed),
    enabled: trimmed.length >= HANDLE_MIN_LENGTH,
    // Un pseudo pris ne se libère pas d'une seconde à l'autre.
    staleTime: 30_000,
  })
}

export function useBlockedAccounts() {
  return useQuery({
    queryKey: communityKeys.blocked(),
    queryFn: () => api.community.listBlocked(),
  })
}

/**
 * Débloquer un compte, depuis la liste des comptes bloqués.
 *
 * Sans optimisme, à la différence des interrupteurs de réglages : lever une
 * protection avant de la savoir levée pour de bon donnerait une fausse
 * information sur ce que l'autre peut voir.
 */
export function useUnblock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (handle: string) => api.community.unblock(handle),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: communityKeys.all })
    },
  })
}
