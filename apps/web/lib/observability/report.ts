/**
 * Remontée des erreurs de l'API v1 vers Sentry.
 *
 * `withApiErrorHandling` attrape toute exception d'une route : Sentry ne la
 * voit donc jamais passer. C'est ici qu'on décide laquelle mérite une issue.
 *
 * **Une réponse d'erreur n'est pas un bug.** Un 401 sur un jeton expiré, un 404
 * sur une plante supprimée, un 429 sur un quota atteint : ce sont des retours
 * normaux, et les remonter noierait en quelques heures les vraies pannes sous
 * des milliers d'événements — le plan gratuit plafonne à 5 000 par mois.
 */

import * as Sentry from '@sentry/nextjs'
import { waitUntil } from '@vercel/functions'

import { isServiceError, type ServiceErrorCode } from '@/lib/services/errors'

/**
 * Les deux seuls codes qui disent « quelque chose ne va pas de notre côté ».
 *
 * `CONFLICT` n'y est pas, pour la même raison que `NOT_FOUND` : c'est une
 * réponse à une demande impossible (un pseudo déjà pris), pas une défaillance.
 */
export const REPORTED_SERVICE_CODES: readonly ServiceErrorCode[] = ['INTERNAL', 'UNAVAILABLE']

/** Une exception mérite-t-elle une issue Sentry ? */
export function shouldReport(err: unknown): boolean {
  if (!isServiceError(err)) return true
  return REPORTED_SERVICE_CODES.includes(err.code)
}

function urlOf(arg: unknown): string | undefined {
  if (typeof arg !== 'object' || arg === null || !('url' in arg)) return undefined
  const url = (arg as { url?: unknown }).url
  return typeof url === 'string' ? url : undefined
}

function paramsOf(arg: unknown): Record<string, unknown> | undefined {
  if (typeof arg !== 'object' || arg === null || !('params' in arg)) return undefined
  const params = (arg as { params?: unknown }).params
  return typeof params === 'object' && params !== null
    ? (params as Record<string, unknown>)
    : undefined
}

/**
 * Chemin de la route, identifiants remplacés par le nom du segment
 * (`/api/v1/plants/[id]`).
 *
 * Regrouper les erreurs suppose un nom stable : avec l'identifiant en clair,
 * la même panne ferait autant d'issues distinctes que de plantes concernées —
 * et le chemin porterait au passage un identifiant d'utilisateur.
 *
 * Les valeurs viennent du contexte que Next passe au handler (`{ params }`),
 * ce qui rend la substitution exacte, sans deviner ce qui ressemble à un id.
 */
export function normalizeRoute(args: readonly unknown[]): string | undefined {
  const raw = urlOf(args[0])
  if (!raw) return undefined

  let path: string
  try {
    path = new URL(raw).pathname
  } catch {
    return undefined
  }

  const params = paramsOf(args[1])
  if (!params) return path

  for (const [key, value] of Object.entries(params)) {
    for (const segment of Array.isArray(value) ? value : [value]) {
      if (typeof segment === 'string' && segment.length > 0) {
        path = path.split(segment).join(`[${key}]`)
      }
    }
  }

  return path
}

/**
 * Remonte l'exception, si elle en vaut la peine.
 *
 * **Ne lève jamais** : une erreur d'observabilité ne doit pas se substituer à
 * l'erreur qu'on essayait de décrire.
 */
export function captureApiException(err: unknown, route?: string): void {
  try {
    if (!shouldReport(err)) return

    const tags: Record<string, string> = {}
    if (route) tags.route = route
    if (isServiceError(err)) tags.service_code = err.code

    Sentry.captureException(err, { tags })

    /*
     * `captureException` ne fait que **mettre en file**. Sur Vercel, la
     * fonction est gelée dès la réponse rendue : sans cette poussée, un
     * événement capturé sur une requête isolée — c'est-à-dire presque toutes —
     * meurt avec la fonction, sans la moindre trace.
     *
     * `waitUntil` garde la fonction en vie le temps de l'envoi, sans retarder
     * la réponse d'une milliseconde. Hors de Vercel, c'est un no-op et la
     * promesse suit son cours. Deux secondes suffisent : au-delà, mieux vaut
     * perdre l'événement que retenir une fonction.
     */
    waitUntil(Sentry.flush(2000))
  } catch (reportingError) {
    console.error('[observability] remontée Sentry impossible', reportingError)
  }
}
