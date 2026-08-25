import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { DiagnoseApiResponse, DiagnoseRequest } from '@growi/shared'

import { api } from '@/lib/api'
import {
  diagnosisKeys,
  gardenKeys,
  planningKeys,
  plantKeys,
  summaryKeys,
} from '@/lib/queries/keys'

export { diagnosisKeys }

/**
 * Diagnostic d'une plante par photo.
 *
 * Chaque appel au modèle est facturé : aucune reprise automatique, c'est
 * l'utilisateur qui relance. Attention, la mutation **réussit** même quand
 * l'analyse échoue (`diagnosed: false`) — un motif à afficher n'est pas une
 * erreur de transport.
 */
export function useDiagnosePlant(plantId: string) {
  const queryClient = useQueryClient()

  return useMutation<DiagnoseApiResponse, unknown, DiagnoseRequest>({
    mutationFn: (body) => api.diagnosis.diagnose(plantId, body),
    retry: false,
    onSuccess: (response) => {
      // Rien n'est écrit quand l'analyse échoue : pas d'historique à relire.
      if (response.diagnosed) {
        void queryClient.invalidateQueries({ queryKey: diagnosisKeys.list(plantId) })
      }
    },
  })
}

/**
 * Applique à la plante l'état proposé, sur accord explicite de l'utilisateur.
 *
 * Le serveur note aussi un geste de santé et invalide les conseils du jardin :
 * la fiche, le journal, le planning et l'accueil doivent donc tous être relus.
 */
export function useApplyDiagnosis(plantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (diagnosisId: string) => api.diagnosis.applyStatus(plantId, diagnosisId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: plantKeys.detail(plantId) })
      void queryClient.invalidateQueries({ queryKey: plantKeys.logs(plantId) })
      void queryClient.invalidateQueries({ queryKey: diagnosisKeys.list(plantId) })
      void queryClient.invalidateQueries({ queryKey: gardenKeys.all })
      void queryClient.invalidateQueries({ queryKey: planningKeys.all })
      void queryClient.invalidateQueries({ queryKey: summaryKeys.all })
    },
  })
}

/**
 * Transforme les recommandations d'un diagnostic en tâches du planning.
 *
 * Idempotent côté serveur : rejouer l'appel rend l'état existant sans créer de
 * doublon. L'Accueil, le Calendrier et la fiche doivent tous être relus — les
 * tâches y arrivent fusionnées aux actions du moteur.
 */
export function usePlanDiagnosisActions(plantId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (diagnosisId: string) => api.diagnosis.planActions(plantId, diagnosisId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: diagnosisKeys.list(plantId) })
      void queryClient.invalidateQueries({ queryKey: plantKeys.detail(plantId) })
      void queryClient.invalidateQueries({ queryKey: planningKeys.all })
      void queryClient.invalidateQueries({ queryKey: gardenKeys.all })
      void queryClient.invalidateQueries({ queryKey: summaryKeys.all })
    },
  })
}

/** Historique des diagnostics d'une plante, du plus récent au plus ancien. */
export function useDiagnoses(plantId: string) {
  return useQuery({
    queryKey: diagnosisKeys.list(plantId),
    queryFn: () => api.diagnosis.list(plantId),
    enabled: Boolean(plantId),
  })
}

/** Un diagnostic complet — chargé à l'ouverture, la liste porte déjà l'essentiel. */
export function useDiagnosis(plantId: string, diagnosisId: string) {
  return useQuery({
    queryKey: diagnosisKeys.detail(plantId, diagnosisId),
    queryFn: () => api.diagnosis.get(plantId, diagnosisId),
    enabled: Boolean(plantId) && Boolean(diagnosisId),
  })
}
