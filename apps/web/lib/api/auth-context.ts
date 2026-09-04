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

import type { ActivitySurface } from '@growi/shared'
import { headers } from 'next/headers'

import { auth } from '@/auth'
import { parseBearerToken, verifyAccessToken } from '@/lib/auth/tokens'
import { prisma } from '@/lib/prisma'
import { touchActivity } from '@/lib/services/activity.service'
import { ServiceError } from '@/lib/services/errors'

/**
 * Identifiant de l'utilisateur courant, ou `null` si la requête est anonyme.
 *
 * Deux effets de bord s'y greffent, parce que c'est le seul endroit traversé
 * par toutes les requêtes authentifiées de l'API :
 * - un compte désactivé est traité comme anonyme ;
 * - l'activité est notée, au plus une fois par heure et sans jamais bloquer.
 *
 * @throws ServiceError('UNAUTHENTICATED') si un Bearer est présenté mais invalide.
 */
export async function getUserId(): Promise<string | null> {
  const bearer = parseBearerToken(headers().get('authorization'))

  let userId: string | null
  let surface: ActivitySurface

  if (bearer) {
    // Laisse remonter : présenter un jeton invalide n'est pas « être anonyme ».
    userId = await verifyAccessToken(bearer)
    surface = 'mobile'
  } else {
    const session = await auth()
    userId = session?.user?.id ?? null
    surface = 'web'
  }

  if (!userId) return null

  // Le jeton d'accès vit 15 minutes et ne sait rien d'une désactivation
  // survenue depuis : il faut la lire en base. La requête est indexée sur la
  // clé primaire, et sert aussi de garde-fou contre un compte supprimé dont un
  // jeton court encore.
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { disabledAt: true },
  })
  if (!account || account.disabledAt) return null

  touchActivity(userId, surface)

  return userId
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
