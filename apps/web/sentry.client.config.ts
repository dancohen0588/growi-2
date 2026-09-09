/**
 * Sentry — navigateur.
 *
 * Next 14 charge ce fichier via le plugin `withSentryConfig` (le
 * `instrumentation-client.ts` des versions récentes demande Next 15.3+).
 *
 * Le replay de session est **éteint par défaut** : on n'enregistre que les
 * sessions où une erreur survient, et encore, avec tout le texte masqué et
 * tous les médias bloqués. Une capture systématique filmerait le jardin, les
 * messages et l'adresse de quelqu'un pour un bénéfice qu'on n'a pas.
 */

import * as Sentry from '@sentry/nextjs'

import { baseSentryOptions } from '@/lib/observability/sentry-options'

const options = baseSentryOptions()

if (options.enabled) {
  Sentry.init({
    ...options,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1,
    integrations: [
      Sentry.replayIntegration({
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],
  })
}
