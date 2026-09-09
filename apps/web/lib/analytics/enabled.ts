/**
 * Le seul juge de « l'analyse d'usage a-t-elle lieu d'être ? ».
 *
 * À part du provider parce que c'est la règle qu'on veut pouvoir tester sans
 * monter React ni charger posthog-js : sans clé, ou hors d'un déploiement
 * Vercel, **rien ne doit partir**. Un rechargement à chaud en local n'a pas à
 * consommer le quota mensuel, et surtout pas à polluer l'entonnoir
 * d'activation avec les parcours de ceux qui développent l'app.
 */

import { resolveEnvironment } from '@/lib/observability/sentry-options'

type Env = Record<string, string | undefined>

export function analyticsEnabled(env: Env = process.env): boolean {
  return Boolean(env.NEXT_PUBLIC_POSTHOG_KEY) && resolveEnvironment(env) !== 'development'
}
