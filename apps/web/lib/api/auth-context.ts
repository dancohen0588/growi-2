/**
 * Récupération de l'utilisateur courant pour les routes `/api/v1/*`.
 *
 * Point de bascule unique du mécanisme d'authentification : aujourd'hui la
 * session NextAuth (cookies), demain le JWT `Authorization: Bearer` de l'app
 * mobile (phase 3 du plan). Les routes n'appellent que `requireUserId()` et
 * n'ont donc rien à changer le jour venu.
 */

import { auth } from '@/auth'
import { ServiceError } from '@/lib/services/errors'

/** Identifiant de l'utilisateur courant, ou `null` si la requête est anonyme. */
export async function getUserId(): Promise<string | null> {
  const session = await auth()
  return session?.user?.id ?? null
}

/**
 * Identifiant de l'utilisateur courant.
 * @throws ServiceError('UNAUTHENTICATED') si la requête n'est pas authentifiée.
 */
export async function requireUserId(): Promise<string> {
  const userId = await getUserId()
  if (!userId) {
    throw new ServiceError('UNAUTHENTICATED', 'Authentification requise')
  }
  return userId
}
