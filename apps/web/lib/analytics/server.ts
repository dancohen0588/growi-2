/**
 * PostHog côté serveur — les faits que le client ne voit pas.
 *
 * Le résultat d'une identification, les jetons consommés par un appel IA, la
 * tournée de notifications du matin : rien de tout cela n'existe dans un
 * navigateur. Le serveur voit aussi ce qu'un client pourrait taire — un
 * bloqueur, une app fermée avant l'envoi — d'où la règle : **ce qui se produit
 * s'émet ici, ce que l'utilisateur fait s'émet là-bas**.
 *
 * Trois règles, calquées sur `activity.service.ts` :
 *
 * 1. **Rien ne lève.** Un événement perdu est une ligne de moins dans un
 *    graphique ; il n'a jamais à faire échouer le geste qu'il décrit.
 * 2. **Rien ne s'attend.** Aucune fonction n'est `async` : l'appelant n'a ni
 *    `await` à écrire ni `try` à poser.
 * 3. **Rien ne part en local ni en test.** Sans clé, hors Vercel, ou sous
 *    Vitest, le client n'est même pas construit.
 *
 * ## Envoi sur des fonctions serverless
 *
 * Le problème propre à Vercel : la fonction est gelée dès la réponse rendue,
 * souvent avant que le lot de posthog-node ne soit parti. Trois options se
 * présentaient — `await shutdown()` en fin de handler (bloque la réponse),
 * s'en remettre à `flushAt`/`flushInterval` (perd les événements des requêtes
 * isolées, c'est-à-dire presque toutes), ou `waitUntil`.
 *
 * **On prend `waitUntil`** : la plateforme garde la fonction en vie jusqu'à ce
 * que la promesse soit tenue, sans retarder d'une milliseconde la réponse à
 * l'utilisateur. Hors de Vercel — en local, en test — l'appel est un no-op, et
 * la promesse suit son cours normalement.
 */

import type { GrowiEventName, GrowiEventProps, PersonProperties } from '@growi/shared'
import { waitUntil } from '@vercel/functions'
import { PostHog } from 'posthog-node'

import { resolveEnvironment } from '@/lib/observability/sentry-options'

/**
 * Côté serveur on lit `POSTHOG_KEY` en premier — même valeur que la clé
 * publique, mais nommée sans `NEXT_PUBLIC_` pour ne pas laisser croire qu'elle
 * n'existe que dans le bundle navigateur.
 */
const KEY = process.env.POSTHOG_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY
const HOST = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com'

/**
 * Propriétés communes des événements serveur.
 *
 * `surface: 'server'` et non `web`/`mobile` : le serveur ne sait pas toujours
 * d'où vient l'appel, et deviner serait pire que de le dire. La plateforme de
 * l'utilisateur est portée par la propriété de personne `last_platform`, posée
 * là où elle est réellement connue — `lib/api/auth-context.ts`.
 */
function commonProperties(): Record<string, string> {
  return {
    surface: 'server',
    environment: resolveEnvironment(),
    app_version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? 'dev',
  }
}

function analyticsEnabled(): boolean {
  if (!KEY) return false
  // Les tests unitaires doublent ce module ; ce garde-fou couvre l'oubli.
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return false
  return resolveEnvironment() !== 'development'
}

let client: PostHog | null | undefined

/** Le client, construit à la première utilisation — ou `null` s'il n'a pas lieu d'être. */
function getClient(): PostHog | null {
  if (client !== undefined) return client

  client = analyticsEnabled()
    ? new PostHog(KEY as string, {
        host: HOST,
        // Le lot n'est de toute façon presque jamais atteint : une requête
        // émet un ou deux événements, et `waitUntil` les fait partir tout de
        // suite. Ces réglages ne servent qu'aux traitements longs — la tournée
        // du matin, qui écrit des centaines d'événements d'affilée.
        flushAt: 20,
        flushInterval: 10_000,
      })
    : null

  return client
}

/** Une seule plainte par process : un journal saturé ne dit plus rien. */
let failureLogged = false

function complainOnce(error: unknown): void {
  if (failureLogged) return
  failureLogged = true
  console.error('[analytics] émission impossible', error)
}

/** Fait partir ce qui est en attente sans retarder la réponse. */
function flushSoon(posthog: PostHog): void {
  try {
    waitUntil(posthog.flush().catch(complainOnce))
  } catch (error) {
    complainOnce(error)
  }
}

/**
 * Enregistre un fait du catalogue au nom d'un utilisateur.
 *
 * **Ne lève jamais, ne s'attend pas.**
 */
export function trackServer<N extends GrowiEventName>(
  userId: string,
  name: N,
  props: GrowiEventProps<N>,
): void {
  try {
    const posthog = getClient()
    if (!posthog) return

    posthog.capture({
      distinctId: userId,
      event: name,
      properties: { ...commonProperties(), ...props },
    })

    flushSoon(posthog)
  } catch (error) {
    complainOnce(error)
  }
}

/**
 * Enregistre un fait qu'on ne peut rattacher à personne — un échec de
 * connexion, par définition.
 *
 * `$process_person_profile: false` empêche PostHog de créer une personne pour
 * ce faux identifiant : sans lui, tous les échecs de tous les visiteurs
 * s'agrégeraient en un seul « utilisateur » fantôme, qui apparaîtrait dans les
 * comptes d'actifs.
 */
export function trackAnonymous<N extends GrowiEventName>(
  name: N,
  props: GrowiEventProps<N>,
): void {
  try {
    const posthog = getClient()
    if (!posthog) return

    posthog.capture({
      distinctId: 'anonymous',
      event: name,
      properties: { ...commonProperties(), ...props, $process_person_profile: false },
    })

    flushSoon(posthog)
  } catch (error) {
    complainOnce(error)
  }
}

/**
 * Met à jour l'état du compte — voir `PersonProperties`.
 *
 * Ce ne sont pas des événements : chaque écriture écrase la précédente, et
 * c'est ce qui permet de filtrer un tableau de bord sur « les testeurs » ou
 * « ceux qui ont activé la communauté ».
 */
export function setPersonProperties(
  userId: string,
  properties: Partial<PersonProperties>,
): void {
  try {
    const posthog = getClient()
    if (!posthog) return

    posthog.identify({ distinctId: userId, properties })
    flushSoon(posthog)
  } catch (error) {
    complainOnce(error)
  }
}

/**
 * Vide la file et ferme le client.
 *
 * Réservé aux scripts qui tournent hors serveur (`scripts/`), où il n'y a ni
 * `waitUntil` ni requête suivante pour emporter le reste.
 */
export async function shutdownAnalytics(): Promise<void> {
  try {
    await client?.shutdown()
  } catch (error) {
    complainOnce(error)
  }
}
