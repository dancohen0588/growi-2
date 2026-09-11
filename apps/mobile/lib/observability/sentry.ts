/**
 * Sentry — application mobile.
 *
 * `initSentry()` est appelé tout en haut de `app/_layout.tsx`, avant le
 * premier rendu : une erreur survenue pendant le démarrage est justement
 * celle qu'on ne peut reproduire sur aucun simulateur.
 *
 * Quatre règles, les mêmes que côté web :
 *
 * 1. **Rien ne part en développement** (`__DEV__`) ni sans DSN. Le plan
 *    gratuit plafonne à 5 000 erreurs par mois ; un rechargement à chaud raté
 *    n'a pas à les consommer.
 * 2. **Aucune donnée personnelle** : `sendDefaultPii: false`, pas de capture
 *    d'écran jointe, `scrubEvent` de `@growi/shared` en dernière barrière.
 * 3. **Rien ne lève.** Une observabilité en panne ne doit pas empêcher l'app
 *    de démarrer : tout est enveloppé.
 * 4. **Aucun identifiant dans un nom de span** : `beforeSendSpan` normalise
 *    les URL, sans quoi chaque fiche plante ferait sa propre ligne dans les
 *    performances.
 */

import { normalizeUrl, scrubEvent } from '@growi/shared'
import * as Sentry from '@sentry/react-native'
import * as Application from 'expo-application'
import Constants from 'expo-constants'
import { Platform } from 'react-native'

/** Environnements où l'on remonte quelque chose. */
export type MobileEnvironment = 'preview' | 'production' | 'development'

/**
 * Environnement du build, posé par profil dans `eas.json`.
 *
 * Défaut `production` : un build sans la variable est un build de store, pas
 * un build de test. Se tromper dans ce sens mélange des remontées de preview
 * aux vraies ; se tromper dans l'autre les perdrait toutes.
 */
export function resolveEnvironment(): MobileEnvironment {
  const env = process.env.EXPO_PUBLIC_APP_ENV
  if (env === 'preview' || env === 'development') return env
  return 'production'
}

/** Vrai dans les builds de test, seuls à porter les outils de vérification. */
export function isPreviewBuild(): boolean {
  return resolveEnvironment() === 'preview'
}

/**
 * Version lisible par Sentry : `growi-mobile@1.0.0+42`.
 *
 * Le numéro de build vient d'`expo-application`, donc du binaire lui-même —
 * et non d'`app.json`, qui vaut toujours `1` depuis qu'EAS incrémente les
 * numéros de son côté (`appVersionSource: "remote"`). Avec la valeur du
 * fichier, toutes les versions se confondraient en une seule release.
 */
export function resolveRelease(): string {
  const version = Constants.expoConfig?.version ?? '0.0.0'
  return `growi-mobile@${version}+${resolveBuildNumber()}`
}

export function resolveBuildNumber(): string {
  return Application.nativeBuildVersion ?? '0'
}

/**
 * Intégration de navigation, à enregistrer sur le conteneur d'expo-router
 * depuis le layout racine (`registerNavigationContainer`).
 *
 * Exportée parce que l'objet doit être **le même** des deux côtés : celui
 * passé à `init` et celui que le layout branche.
 */
export const navigationIntegration = Sentry.reactNavigationIntegration({
  // Temps jusqu'à la première image de l'écran : la mesure qui dit ce que
  // l'utilisateur attend vraiment en changeant d'onglet.
  enableTimeToInitialDisplay: true,
})

let initialized = false

export function initSentry(): void {
  if (initialized) return

  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN
  if (!dsn || __DEV__) return

  try {
    Sentry.init({
      dsn,
      environment: resolveEnvironment(),
      release: resolveRelease(),
      // `dist` distingue deux builds d'une même version : c'est lui qui relie
      // une pile aux bonnes source maps.
      dist: resolveBuildNumber(),

      sendDefaultPii: false,
      // Une capture d'écran d'erreur montrerait le jardin, un message, une
      // adresse. Le fil d'Ariane suffit à comprendre.
      attachScreenshot: false,

      tracesSampleRate: 1,
      enableAutoSessionTracking: true,
      enableNativeCrashHandling: true,
      enableAppHangTracking: true,
      enableStallTracking: true,

      integrations: [navigationIntegration],

      initialScope: { tags: { surface: 'mobile', platform: Platform.OS } },

      beforeSend: scrubEvent,
      beforeSendSpan: (span) => {
        const url = span.data?.['url']
        if (span.data && typeof url === 'string') span.data['url'] = normalizeUrl(url)
        if (span.description) span.description = normalizeSpanDescription(span.description)
        return span
      },
    })

    initialized = true
  } catch (error) {
    // Une observabilité qui empêche de démarrer est pire que pas
    // d'observabilité du tout.
    console.warn('[observability] initialisation de Sentry impossible', error)
  }
}

/**
 * Le SDK nomme une requête `GET https://…/plants/clx…/logs`. On y remplace
 * l'identifiant, sans toucher au verbe ni à l'hôte.
 */
export function normalizeSpanDescription(description: string): string {
  const [method, ...rest] = description.split(' ')
  if (rest.length === 0) return normalizeUrl(description)
  return `${method} ${normalizeUrl(rest.join(' '))}`
}

/**
 * Attache la personne connectée — **son identifiant interne et rien
 * d'autre**. C'est ce qui permet de lire « combien d'utilisateurs sont
 * touchés », le seul tri utile dans la boîte Issues.
 */
export function identifyUser(userId: string): void {
  try {
    Sentry.setUser({ id: userId })
  } catch {
    // Silencieux : voir la règle 3.
  }
}

/**
 * Détache la personne : déconnexion, session perdue, installation neuve.
 *
 * Sans cet appel, les erreurs suivantes seraient imputées à quelqu'un qui
 * n'est plus là — et sur un téléphone prêté, à quelqu'un d'autre.
 */
export function forgetUser(): void {
  try {
    Sentry.setUser(null)
  } catch {
    // Silencieux.
  }
}
