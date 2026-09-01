/**
 * Erreurs métier de la couche services.
 *
 * Les services ne connaissent ni HTTP ni Next.js : ils lèvent une
 * `ServiceError` portant un code stable, que l'appelant traduit en statut HTTP
 * (routes API) ou en message d'erreur (Server Actions).
 */

export type ServiceErrorCode =
  | 'UNAUTHENTICATED'
  | 'NOT_FOUND'
  | 'FORBIDDEN'
  | 'CONFLICT'
  | 'INVALID_INPUT'
  | 'RATE_LIMITED'
  /**
   * Plafond d'usage d'un compte atteint — distinct de `RATE_LIMITED`, qui
   * freine un débit. Le client en fait un message tout autre : « reviens
   * demain », et non « réessaie dans un instant ».
   */
  | 'QUOTA_EXCEEDED'
  | 'UNAVAILABLE'
  | 'INTERNAL'

export class ServiceError extends Error {
  readonly code: ServiceErrorCode

  constructor(code: ServiceErrorCode, message: string) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
  }
}

export function isServiceError(err: unknown): err is ServiceError {
  return err instanceof ServiceError
}

/** Statut HTTP associé à chaque code — utilisé par les routes `/api/v1/*`. */
export const SERVICE_ERROR_STATUS: Record<ServiceErrorCode, number> = {
  UNAUTHENTICATED: 401,
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  CONFLICT: 409,
  INVALID_INPUT: 400,
  RATE_LIMITED: 429,
  QUOTA_EXCEEDED: 429,
  UNAVAILABLE: 503,
  INTERNAL: 500,
}
