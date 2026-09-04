/**
 * Prédicats de rôle, sans aucune dépendance.
 *
 * Ils vivent à part de `lib/admin/auth.ts` pour deux raisons, toutes deux
 * structurelles :
 *
 * - `auth.ts` a besoin de valider le rôle dans son callback `jwt`, et
 *   `lib/admin/auth.ts` importe `auth` — les mettre ensemble ferait un cycle ;
 * - `auth.config.ts` s'exécute dans le **runtime Edge** du middleware, où
 *   Prisma n'a pas sa place. Ce fichier n'en tire aucune.
 */

import type { UserRole } from '@growi/shared'
import { USER_ROLES } from '@growi/shared'

export function isUserRole(value: unknown): value is UserRole {
  return typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value)
}

/** Le compte a-t-il les droits d'administration ? */
export function isAdminRole(value: unknown): boolean {
  return value === 'ADMIN'
}
