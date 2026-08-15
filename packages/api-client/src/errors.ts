/**
 * Erreur normalisée du client API.
 *
 * Toute défaillance — réponse d'erreur du serveur, panne réseau, corps
 * illisible — arrive à l'appelant sous cette forme, avec un `code` stable
 * plutôt qu'un message à interpréter.
 */
export class ApiError extends Error {
  /** Statut HTTP, ou 0 quand la requête n'a pas abouti (réseau, timeout). */
  readonly status: number
  /** Code renvoyé par l'API (`NOT_FOUND`, `INVALID_INPUT`…) ou code client. */
  readonly code: string
  /** Corps brut de la réponse, quand il a pu être lu. */
  readonly body?: unknown

  constructor(status: number, code: string, message: string, body?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.body = body
  }

  /** Requête refusée faute d'authentification valide. */
  get isUnauthorized(): boolean {
    return this.status === 401
  }

  /** Ressource inexistante — ou appartenant à quelqu'un d'autre. */
  get isNotFound(): boolean {
    return this.status === 404
  }

  /** Corps de requête invalide. */
  get isValidationError(): boolean {
    return this.status === 400
  }

  /** La requête n'a jamais atteint le serveur : hors ligne, DNS, timeout. */
  get isNetworkError(): boolean {
    return this.status === 0
  }

  /** Panne côté serveur : une nouvelle tentative a du sens. */
  get isServerError(): boolean {
    return this.status >= 500
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError
}

/** Codes produits par le client lui-même, en dehors de toute réponse serveur. */
export const CLIENT_ERROR_CODES = {
  NETWORK: 'NETWORK_ERROR',
  INVALID_RESPONSE: 'INVALID_RESPONSE',
  ABORTED: 'ABORTED',
} as const
