/**
 * Sentry — runtime Node (routes `/api/v1/*`, Server Actions, rendu serveur).
 *
 * Chargé par `instrumentation.ts`, avant tout code applicatif. Les réglages
 * communs vivent dans `lib/observability/sentry-options.ts`.
 */

import * as Sentry from '@sentry/nextjs'

import { baseSentryOptions } from '@/lib/observability/sentry-options'

const options = baseSentryOptions()

if (options.enabled) {
  Sentry.init({
    ...options,
    integrations: [
      // `httpIntegration` est déjà par défaut ; Prisma, non. Elle donne les
      // requêtes SQL lentes sous la transaction de la route.
      // Prisma 6 la sert sans `previewFeatures = ["tracing"]` : ne pas
      // l'ajouter au schéma, ce serait une migration pour rien.
      Sentry.prismaIntegration(),
    ],
  })
}
