/**
 * Récupération de l'utilisateur courant pour les routes `/api/v1/*`.
 *
 * Deux mécanismes cohabitent, dans cet ordre :
 * 1. un access token JWT en `Authorization: Bearer …` — l'app mobile ;
 * 2. la session NextAuth par cookies — le web.
 *
 * Le Bearer est examiné en premier : une requête qui en présente un exprime
 * une intention claire, et il ne faut pas la servir silencieusement avec la
 * session cookie d'un autre compte si le jeton est invalide.
 *
 * C'est le seul endroit du code qui sait comment on authentifie : les routes
 * n'appellent que `requireUserId()`.
 */

import { headers } from 'next/headers'

import { auth } from '@/auth'
import { parseBearerToken, verifyAccessToken } from '@/lib/auth/tokens'
import { ServiceError } from '@/lib/services/errors'

/**
 * Identifiant de l'utilisateur courant, ou `null` si la requête est anonyme.
 * @throws ServiceError('UNAUTHENTICATED') si un Bearer est présenté mais invalide.
 */
export async function getUserId(): Promise<string | null> {
  const bearer = parseBearerToken(headers().get('authorization'))
  if (bearer) {
    // Laisse remonter : présenter un jeton invalide n'est pas « être anonyme ».
    return verifyAccessToken(bearer)
  }

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
