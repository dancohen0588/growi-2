/**
 * Lecture des filtres depuis l'URL.
 *
 * **L'URL est l'état de la vue.** Une liste filtrée se partage par copier-coller,
 * « précédent » défait le dernier filtre, et rafraîchir ne perd rien. C'est
 * aussi ce qui permet aux pages de rester des Server Components : il n'y a pas
 * d'état de filtre côté client à hydrater.
 *
 * Tout y est tolérant : un paramètre absurde vaut « pas de filtre », jamais une
 * erreur. Une URL tronquée dans un message ne doit pas donner un écran rouge.
 */

import type { AuditFilters, AuditCursor } from '@/lib/services/admin-audit.service'
import type { UserCursor, UserListFilters } from '@/lib/services/admin-user.service'

export type SearchParams = Record<string, string | string[] | undefined>

export function readString(params: SearchParams, key: string): string | undefined {
  const raw = params[key]
  const value = Array.isArray(raw) ? raw[0] : raw
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/** `?onboarded=1` / `?onboarded=0`. Toute autre valeur ne filtre pas. */
export function readBoolean(params: SearchParams, key: string): boolean | undefined {
  const value = readString(params, key)
  if (value === '1' || value === 'true') return true
  if (value === '0' || value === 'false') return false
  return undefined
}

/** Une date invalide est ignorée plutôt que de faire échouer la requête. */
export function readDate(params: SearchParams, key: string): Date | undefined {
  const value = readString(params, key)
  if (!value) return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

/**
 * Curseur `(createdAt, id)`, encodé `<iso>|<id>`.
 *
 * Il n'est pas signé : il ne porte aucun droit, seulement une position dans un
 * tri. Un curseur forgé fait au pire commencer la page ailleurs — les filtres
 * et `requireAdmin()` restent, eux, appliqués côté serveur.
 */
export function readCursor(params: SearchParams, key = 'apres'): { createdAt: Date; id: string } | null {
  const value = readString(params, key)
  if (!value) return null

  const separator = value.indexOf('|')
  if (separator <= 0) return null

  const createdAt = new Date(value.slice(0, separator))
  const id = value.slice(separator + 1)
  if (Number.isNaN(createdAt.getTime()) || !id) return null

  return { createdAt, id }
}

export function encodeCursor(cursor: { createdAt: Date; id: string }): string {
  return `${cursor.createdAt.toISOString()}|${cursor.id}`
}

// ─── Vues ──────────────────────────────────────────────────────────────────

export function readUserFilters(params: SearchParams): UserListFilters {
  const role = readString(params, 'role')

  return {
    search: readString(params, 'q'),
    role: role === 'ADMIN' || role === 'USER' ? role : undefined,
    plan: readString(params, 'plan'),
    onboarded: readBoolean(params, 'onboarde'),
    disabled: readBoolean(params, 'desactive'),
    createdAfter: readDate(params, 'inscrit_depuis'),
    activeSince: readDate(params, 'actif_depuis'),
    inactiveSince: readDate(params, 'inactif_depuis'),
  }
}

export function readAuditFilters(params: SearchParams): AuditFilters {
  return {
    actorId: readString(params, 'acteur'),
    action: readString(params, 'action'),
    targetType: readString(params, 'cible'),
    targetId: readString(params, 'cible_id'),
    from: readDate(params, 'du'),
    to: readDate(params, 'au'),
  }
}

export function readUserCursor(params: SearchParams): UserCursor | null {
  return readCursor(params)
}

export function readAuditCursor(params: SearchParams): AuditCursor | null {
  return readCursor(params)
}

/**
 * Reconstruit une query string en modifiant certaines clés.
 *
 * Une valeur `undefined` retire la clé — c'est ainsi qu'un changement de filtre
 * remet la pagination à zéro : on passe `{ apres: undefined }`.
 */
export function buildQuery(params: SearchParams, changes: Record<string, string | undefined>): string {
  const next = new URLSearchParams()

  for (const [key, raw] of Object.entries(params)) {
    const value = Array.isArray(raw) ? raw[0] : raw
    if (value) next.set(key, value)
  }

  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) next.delete(key)
    else next.set(key, value)
  }

  const query = next.toString()
  return query ? `?${query}` : ''
}
