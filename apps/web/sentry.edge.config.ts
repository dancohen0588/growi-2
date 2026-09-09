/**
 * Sentry — runtime Edge (le middleware, seul code du projet qui y tourne).
 *
 * Ni Prisma ni Node ici : `auth.config.ts` s'exécute dans ce runtime et n'a le
 * droit d'importer aucun des deux. La configuration se limite donc au socle.
 */

import * as Sentry from '@sentry/nextjs'

import { baseSentryOptions } from '@/lib/observability/sentry-options'

const options = baseSentryOptions()

if (options.enabled) {
  Sentry.init(options)
}
