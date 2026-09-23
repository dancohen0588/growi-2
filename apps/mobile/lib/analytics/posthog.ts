/**
 * PostHog côté mobile.
 *
 * Seul module de l'app à connaître le SDK : les écrans passent par
 * `useTrack()`, typé sur le catalogue de `@growi/shared`. Un nom d'événement
 * inventé sur place ne compile pas.
 *
 * Mêmes règles que côté web, plus une propre au mobile :
 *
 * - **Le client n'existe pas tant que le compte n'a pas dit oui.** Aucun
 *   identifiant d'appareil n'est écrit avant (ePrivacy, recommandation CNIL
 *   sur les applications). Refuser arrête les événements tout de suite, et
 *   l'enregistrement d'écran au prochain lancement : le SDK ne sait pas
 *   l'éteindre en cours de session, et le client n'est alors plus créé.
 * - **Rien ne part en `__DEV__` ni sans clé.** L'émetteur est alors muet, et
 *   le code appelant n'a jamais à se demander si l'analyse est configurée.
 * - **Aucun texte saisi ne voyage** : le catalogue s'y oppose déjà par ses
 *   types, l'enregistrement de session masque le reste.
 * - **Rien ne lève** : `createSafeEmitter` enveloppe le SDK. Un `track` posé
 *   dans un `onPress` ne doit pas pouvoir empêcher le geste qu'il mesure.
 * - **`reset()` est réservé à la déconnexion volontaire.** Il jette
 *   l'identifiant anonyme de l'appareil : appelé sur un jeton expiré ou une
 *   coupure réseau, il transforme un même testeur en un profil de plus à
 *   chaque incident, et les entonnoirs ne convergent plus. `store/session.ts`
 *   ne l'appelle que dans `signOut`.
 */

import type { GrowiEventName, GrowiEventProps } from '@growi/shared'
import { createNoopEmitter, createSafeEmitter, type Emitter } from '@growi/shared'
import Constants from 'expo-constants'
import PostHog from 'posthog-react-native'
import { Platform } from 'react-native'

import { resolveBuildNumber, resolveEnvironment } from '@/lib/observability/sentry'

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://eu.i.posthog.com'

/** Le client, ou `null` quand l'analyse n'a pas lieu d'être. */
let client: PostHog | null = null

function createClient(): PostHog | null {
  if (!KEY || __DEV__) return null

  return new PostHog(KEY, {
    host: HOST,
    // Ouvertures, mises à jour, passages en arrière-plan : c'est ce qui donne
    // les sessions et la rétention, sans qu'aucun écran ait à s'en occuper.
    captureAppLifecycleEvents: true,
    enableSessionReplay: true,
    sessionReplayConfig: {
      // Un jardin, un message, une adresse : rien de tout cela n'a à être
      // rejoué. On masque le texte saisi **et** les images, qui sont
      // essentiellement les photos de plantes des utilisateurs.
      maskAllTextInputs: true,
      maskAllImages: true,
    },
  })
}

/** Émetteur de l'app. Muet tant que le compte n'a pas donné son accord. */
let emitter: Emitter = createNoopEmitter()

/**
 * La mesure est-elle ouverte ? Distinct de l'existence du client : un client
 * créé puis mis en retrait survit jusqu'au prochain lancement, et les vues
 * d'écran — qui le visent directement — ne doivent plus partir.
 */
let enabled = false

/**
 * Crée le client — une fois — et branche l'émetteur réel. À n'appeler
 * qu'après le oui du compte : c'est la création du client qui écrit
 * l'identifiant d'appareil.
 */
export function enableAnalytics(): void {
  if (!client) {
    client = createClient()
    if (!client) return

    client.register({
      surface: 'mobile',
      platform: Platform.OS,
      app_version: `${Constants.expoConfig?.version ?? '0.0.0'}+${resolveBuildNumber()}`,
      environment: resolveEnvironment(),
    })
  }

  const posthog = client
  emitter = createSafeEmitter({
    track: (name, props) => void posthog.capture(name, props),
    identify: (userId) => posthog.identify(userId),
    reset: () => posthog.reset(),
    // `capture('$set', …)` semblait marcher et ne marchait pas : l'ingestion
    // laissait tomber l'événement en silence, et `onboarding_completed` est
    // resté vide sur tous les profils. Le SDK expose la bonne méthode depuis
    // la v4 — `reloadFeatureFlags` à `false` parce qu'on n'en a aucun.
    setPersonProperties: (properties) => posthog.setPersonProperties(properties, undefined, false),
    optOut: () => void posthog.optOut(),
    optIn: () => void posthog.optIn(),
  })
  // Un client créé dans cette session puis mis en retrait : on rouvre.
  emitter.optIn()
  enabled = true
}

/**
 * Coupe la mesure : le client éventuel cesse d'émettre, l'émetteur redevient
 * muet. Le client n'est pas détruit — le SDK n'a pas de quoi — mais il ne
 * sera pas recréé au prochain lancement tant que le compte ne redit pas oui.
 */
export function disableAnalytics(): void {
  enabled = false
  emitter.optOut()
  emitter = createNoopEmitter()
}

/** Applique le choix du compte : seul `true` ouvre la mesure. */
export function applyAnalyticsConsent(consent: boolean | null | undefined): void {
  if (consent === true) enableAnalytics()
  else disableAnalytics()
}

/** L'émetteur brut — identité, opposition, propriétés de personne. */
export function analytics(): Emitter {
  return emitter
}

/**
 * Émet un événement du catalogue.
 *
 * ```ts
 * const track = useTrack()
 * track('identify_started', { source: 'camera' })
 * ```
 *
 * Ce n'est pas un hook au sens de React — il ne retient rien — mais il en a
 * la forme pour rester interchangeable avec celui du web.
 */
export function useTrack() {
  return <N extends GrowiEventName>(name: N, props: GrowiEventProps<N>): void => {
    emitter.track(name, props)
  }
}

/**
 * Enregistre l'écran vu.
 *
 * Le chemin est normalisé (`/jardins/[id]`) : sans cela, chaque fiche plante
 * ferait son propre écran dans PostHog, et aucun entonnoir ne tiendrait.
 */
export function captureScreen(path: string): void {
  if (enabled) client?.screen(path)
}
