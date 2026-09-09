/**
 * Remontée des erreurs applicatives du mobile.
 *
 * Même principe que côté serveur (`apps/web/lib/observability/report.ts`) :
 * **une erreur attendue n'est pas un bug**. Un réseau coupé dans le métro, un
 * jeton expiré, un quota atteint, une saisie refusée : l'app sait déjà quoi
 * en dire à l'utilisateur, et les remonter noierait les vraies pannes.
 *
 * Ce qui reste : les 5xx, et tout ce qui n'est pas une `ApiError` — c'est-à-
 * dire les erreurs de notre propre code, celles qui affichent « une erreur
 * inattendue s'est produite ».
 */

import { isApiError } from '@growi/api-client'
import { normalizeApiPath } from '@growi/shared'
import * as Sentry from '@sentry/react-native'

/** Une erreur mérite-t-elle d'être remontée ? */
export function shouldReport(error: unknown): boolean {
  if (!isApiError(error)) return true

  // Réseau, 401, 403, 404, 429 et validation : des réponses, pas des pannes.
  if (error.isNetworkError) return false
  if (error.isValidationError) return false
  if (error.status === 401 || error.status === 403 || error.status === 404) return false
  if (error.status === 429) return false

  return error.isServerError
}

export interface ReportContext {
  /** Écran d'où vient l'erreur — chemin expo-router, identifiants ôtés. */
  screen?: string
  /** Ce que faisait l'app : `query`, `mutation`, `push`, … */
  operation?: string
}

/**
 * Remonte une erreur inattendue.
 *
 * **Ne lève jamais** : appelée depuis des `catch`, elle ne doit pas
 * remplacer l'erreur qu'elle décrit.
 */
export function reportError(error: unknown, context: ReportContext = {}): void {
  try {
    if (!shouldReport(error)) return

    Sentry.captureException(error, (scope) => {
      if (context.screen) scope.setTag('screen', normalizeApiPath(context.screen))
      if (context.operation) scope.setTag('operation', context.operation)

      // Un même appel qui échoue sur cent appareils est **une** régression,
      // pas cent : on regroupe sur la route et le statut plutôt que de
      // laisser Sentry regrouper sur la pile, identique mais pas toujours.
      const fingerprint = errorFingerprint(error, context)
      if (fingerprint) scope.setFingerprint(fingerprint)

      return scope
    })
  } catch {
    // Silencieux : une remontée ratée est une donnée en moins, rien de plus.
  }
}

/** Regroupement : route normalisée + statut, quand on les connaît. */
function errorFingerprint(error: unknown, context: ReportContext): string[] | null {
  if (isApiError(error)) {
    return ['api', String(error.status), context.operation ?? 'unknown']
  }
  if (context.screen) {
    return ['screen', normalizeApiPath(context.screen), context.operation ?? 'unknown']
  }
  return null
}
