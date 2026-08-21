import { isApiError } from '@growi/api-client'

/**
 * Traduit une erreur en message affichable.
 *
 * Règle du design system : dire quoi faire, jamais le code technique.
 */
export function errorMessage(error: unknown): string {
  if (!isApiError(error)) return "Une erreur inattendue s'est produite. Réessaie."

  if (error.isNetworkError) return 'Impossible de joindre Growi. Vérifie ta connexion.'
  if (error.isNotFound) return "Cet élément n'existe plus."
  if (error.isUnauthorized) return 'Ta session a expiré. Reconnecte-toi.'
  if (error.status === 429) return error.message
  // Les messages de validation viennent de nos propres schémas : ils sont
  // rédigés pour être lus par un humain.
  if (error.isValidationError) return error.message
  if (error.isServerError) return 'Growi est momentanément indisponible. Réessaie dans un instant.'

  return "Une erreur inattendue s'est produite. Réessaie."
}
