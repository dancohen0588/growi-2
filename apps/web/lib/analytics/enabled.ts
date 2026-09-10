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

/**
 * Même précaution que dans `sentry-options.ts` : l'accès doit être littéral
 * pour que Next inline la valeur dans le bundle navigateur. Lue depuis un
 * paramètre, elle y vaudrait `undefined` et l'analyse serait éteinte partout
 * sans qu'aucune erreur ne le dise.
 */
const BUILD_ENV: Env = {
  NEXT_PUBLIC_POSTHOG_KEY: process.env.NEXT_PUBLIC_POSTHOG_KEY,
  NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
}

export function analyticsEnabled(env: Env = BUILD_ENV): boolean {
  return Boolean(env.NEXT_PUBLIC_POSTHOG_KEY) && resolveEnvironment(env) !== 'development'
}
