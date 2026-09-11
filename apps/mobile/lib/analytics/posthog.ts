/**
 * PostHog côté mobile.
 *
 * Seul module de l'app à connaître le SDK : les écrans passent par
 * `useTrack()`, typé sur le catalogue de `@growi/shared`. Un nom d'événement
 * inventé sur place ne compile pas.
 *
 * Mêmes règles que côté web, plus une propre au mobile :
 *
 * - **Rien ne part en `__DEV__` ni sans clé.** L'émetteur est alors muet, et
 *   le code appelant n'a jamais à se demander si l'analyse est configurée.
 * - **Aucun texte saisi ne voyage** : le catalogue s'y oppose déjà par ses
 *   types, l'enregistrement de session masque le reste.
 * - **Rien ne lève** : `createSafeEmitter` enveloppe le SDK. Un `track` posé
 *   dans un `onPress` ne doit pas pouvoir empêcher le geste qu'il mesure.
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

/**
 * Émetteur de l'app. Muet tant que `initAnalytics()` n'a rien pu créer, ce qui
 * est le cas normal en développement.
 */
let emitter: Emitter = createNoopEmitter()

export function initAnalytics(): void {
  if (client) return

  client = createClient()
  if (!client) return

  const posthog = client
  posthog.register({
    surface: 'mobile',
    platform: Platform.OS,
    app_version: `${Constants.expoConfig?.version ?? '0.0.0'}+${resolveBuildNumber()}`,
    environment: resolveEnvironment(),
  })

  emitter = createSafeEmitter({
    track: (name, props) => void posthog.capture(name, props),
    identify: (userId) => posthog.identify(userId),
    reset: () => posthog.reset(),
    // Le SDK mobile n'a pas de `setPersonProperties` : `$set` est la forme
    // que l'ingestion attend, et c'est ce que fait `identify` en interne.
    setPersonProperties: (properties) => void posthog.capture('$set', { $set: properties }),
    optOut: () => void posthog.optOut(),
    optIn: () => void posthog.optIn(),
  })
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

/** Applique le choix du compte : `true` = l'utilisateur refuse l'analyse. */
export function applyAnalyticsOptOut(optOut: boolean): void {
  if (optOut) emitter.optOut()
  else emitter.optIn()
}

/**
 * Enregistre l'écran vu.
 *
 * Le chemin est normalisé (`/jardins/[id]`) : sans cela, chaque fiche plante
 * ferait son propre écran dans PostHog, et aucun entonnoir ne tiendrait.
 */
export function captureScreen(path: string): void {
  client?.screen(path)
}
