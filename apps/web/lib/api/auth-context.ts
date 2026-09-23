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
import * as Sentry from '@sentry/nextjs'
import { headers } from 'next/headers'

import { auth } from '@/auth'
import { setPersonProperties } from '@/lib/analytics/server'
import { parseBearerToken, verifyAccessToken } from '@/lib/auth/tokens'
import { prisma } from '@/lib/prisma'
import { touchActivity } from '@/lib/services/activity.service'
import { ServiceError } from '@/lib/services/errors'

type CallerPlatform = 'ios' | 'android' | 'web'

/**
 * Plateforme de l'appelant.
 *
 * Le jeton d'accès ne dit pas d'où il vient : l'app pose un en-tête
 * (`lib/api.ts` côté mobile). Sans lui — client plus ancien, appel direct —
 * on s'en tient à `web`, qui est de toute façon le seul cas possible sans
 * Bearer.
 */
function callerPlatform(surface: ActivitySurface): CallerPlatform {
  if (surface !== 'mobile') return 'web'
  const declared = headers().get('x-growi-platform')
  return declared === 'ios' || declared === 'android' ? declared : 'ios'
}

/**
 * Dernière plateforme transmise à PostHog pour chaque compte, par process.
 *
 * `touchActivity` n'ouvre la porte qu'une fois par heure : s'y adosser
 * seule laissait un testeur passé du web à iOS dans l'heure rangé en `web`
 * jusqu'au lendemain — c'est-à-dire précisément pendant la séance où il essaie
 * les deux. On écrit donc **aussi** dès que la plateforme change, sans quoi la
 * propriété décrit moins la personne que le hasard de sa première requête.
 *
 * Ce n'est qu'un anti-répétition : au pire une écriture redondante par
 * instance, que PostHog absorbe comme n'importe quelle mise à jour.
 */
const lastPlatformSent = new Map<string, CallerPlatform>()

/**
 * Au-delà, on repart de zéro. Élaguer finement n'a pas de sens ici — aucune
 * entrée ne périme — et une carte qui enfle indéfiniment sur une instance de
 * longue vie coûte plus qu'une poignée d'écritures redondantes.
 */
const PLATFORM_MAX_ENTRIES = 10_000

/**
 * Tient `last_platform` à jour : à chaque changement, et au rythme horaire de
 * `touchActivity` le reste du temps (ce qui la republie même si une écriture
 * s'est perdue en route).
 */
function refreshLastPlatform(
  userId: string,
  platform: CallerPlatform,
  activityWritten: boolean,
): void {
  if (!activityWritten && lastPlatformSent.get(userId) === platform) return

  if (lastPlatformSent.size >= PLATFORM_MAX_ENTRIES) lastPlatformSent.clear()
  lastPlatformSent.set(userId, platform)
  setPersonProperties(userId, { last_platform: platform })
}

/** Remet la mémoire des plateformes à zéro. Réservé aux tests. */
export function resetPlatformMemory(): void {
  lastPlatformSent.clear()
}

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

  // `touchActivity` n'écrit qu'une fois par heure et par utilisateur, et rend
  // `true` quand elle a écrit : c'est le rythme de fond. Un changement de
  // plateforme, lui, passe devant — voir `refreshLastPlatform`.
  refreshLastPlatform(userId, callerPlatform(surface), touchActivity(userId, surface))

  // Sur qui porte l'erreur, et combien de personnes une régression touche :
  // c'est le seul tri qui vaille dans la boîte Issues. **L'identifiant interne
  // et rien d'autre** — pas d'e-mail, pas de nom, pas de pseudo. Sentry isole
  // le scope par requête, l'identité ne déborde donc pas sur la suivante.
  Sentry.setUser({ id: userId })

  return userId
}

/**
 * Identifiant de l'utilisateur courant, sur une route **volontairement**
 * lisible sans compte — le profil public d'un jardinier, une publication
 * partagée par lien.
 *
 * Rigoureusement `getUserId()`, sous un nom qui dit l'intention : lu dans une
 * route, `getUserId()` laisse croire à un oubli de `requireUserId()`. Un
 * Bearer invalide reste une erreur ici aussi — présenter un jeton cassé n'est
 * pas « visiter anonymement ».
 */
export const optionalUserId = getUserId

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
