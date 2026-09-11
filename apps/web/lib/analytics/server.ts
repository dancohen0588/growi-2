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
import { prisma } from '@/lib/prisma'

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

// ─── Opposition de l'utilisateur ───────────────────────────────────────────

/**
 * Le refus d'analyse est **posé sur le compte**, et l'interrupteur du profil ne
 * coupe que le SDK de l'appareil. Sans ce contrôle, un compte qui a refusé
 * continuait d'envoyer, depuis le serveur, ses inscriptions, ses plantes, ses
 * identifications — tout ce que la page de confidentialité promet d'arrêter.
 *
 * Le choix est relu en base, mais **au plus une fois par heure et par compte**
 * sur chaque instance : une requête par événement coûterait plus que la mesure
 * ne rapporte, sur un pool de connexions qu'on sait étroit. Un changement de
 * réglage est répercuté sur-le-champ par `rememberOptOut`, appelé là où le
 * profil s'écrit ; sur les autres instances, il prend effet dans l'heure.
 */
const OPT_OUT_TTL_MS = 60 * 60 * 1000
const optOutByUser = new Map<string, { value: boolean; expiresAt: number }>()

/** Note un choix connu, pour que l'instance qui l'a reçu l'applique aussitôt. */
export function rememberOptOut(userId: string, optOut: boolean, now = Date.now()): void {
  optOutByUser.set(userId, { value: optOut, expiresAt: now + OPT_OUT_TTL_MS })
}

/**
 * Le compte refuse-t-il l'analyse ? En cas de doute — compte introuvable, base
 * indisponible — la réponse est **oui** : se taire est le repli sûr.
 */
export async function isOptedOut(userId: string, now = Date.now()): Promise<boolean> {
  const cached = optOutByUser.get(userId)
  if (cached && cached.expiresAt > now) return cached.value

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { analyticsOptOut: true },
    })
    const optOut = user?.analyticsOptOut ?? true
    rememberOptOut(userId, optOut, now)
    return optOut
  } catch {
    return true
  }
}

/** Remet la mémoire à zéro. Réservé aux tests. */
export function resetOptOutCache(): void {
  optOutByUser.clear()
}

/** Une seule plainte par process : un journal saturé ne dit plus rien. */
let failureLogged = false

function complainOnce(error: unknown): void {
  if (failureLogged) return
  failureLogged = true
  console.error('[analytics] émission impossible', error)
}

/**
 * Garde la fonction en vie le temps d'une promesse, sans retarder la réponse.
 * Les erreurs y sont avalées : voir la règle 1.
 */
function keepAlive(work: Promise<void>): void {
  try {
    waitUntil(work.catch(complainOnce))
  } catch (error) {
    complainOnce(error)
  }
}

/** Fait partir ce qui est en attente sans retarder la réponse. */
function flushSoon(posthog: PostHog): void {
  keepAlive(posthog.flush())
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

    // Le contrôle d'opposition est asynchrone : c'est donc la chaîne entière —
    // lecture du choix, capture, envoi — que `waitUntil` garde en vie.
    keepAlive(
      (async () => {
        if (await isOptedOut(userId)) return
        posthog.capture({
          distinctId: userId,
          event: name,
          properties: { ...commonProperties(), ...props },
        })
        await posthog.flush()
      })(),
    )
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

    keepAlive(
      (async () => {
        if (await isOptedOut(userId)) return
        posthog.identify({ distinctId: userId, properties })
        await posthog.flush()
      })(),
    )
  } catch (error) {
    complainOnce(error)
  }
}

/**
 * Ce que le serveur voit de PostHog — **sans rien révéler**.
 *
 * Une mesure qui n'arrive pas a plusieurs causes indiscernables de
 * l'extérieur : clé absente, environnement pris pour du développement, client
 * jamais construit. Cette fonction les sépare, et ne rend que des booléens,
 * un nom de variable et l'hôte — jamais la clé.
 *
 * Lue par `/api/v1/debug/sentry?check=1`, qui disparaîtra avec elle à la fin
 * de la Friends & Family.
 */
export function analyticsDiagnostics() {
  return {
    keyConfigured: Boolean(KEY),
    keySource: process.env.POSTHOG_KEY
      ? 'POSTHOG_KEY'
      : process.env.NEXT_PUBLIC_POSTHOG_KEY
        ? 'NEXT_PUBLIC_POSTHOG_KEY'
        : null,
    enabled: analyticsEnabled(),
    clientCreated: Boolean(getClient()),
    host: HOST,
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
