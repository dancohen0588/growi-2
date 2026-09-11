/**
 * Réglages Sentry communs au navigateur, au serveur Node et au runtime Edge.
 *
 * Trois exigences tiennent tout le fichier :
 *
 * 1. **Rien ne part en développement.** Sans DSN — le cas en local — on
 *    n'initialise pas du tout ; avec un DSN mais hors Vercel, `enabled` reste
 *    faux. Un `console.error` de développement ne doit pas consommer le quota.
 * 2. **Aucune donnée personnelle.** `sendDefaultPii: false` empêche le SDK
 *    d'ajouter l'adresse IP et les en-têtes ; `scrubEvent` retire ensuite ce
 *    que notre propre code aurait pu joindre — cookie, jeton, photo, e-mail.
 *    Cette fonction vit dans `@growi/shared` : le mobile applique exactement
 *    les mêmes règles, et une seule est à corriger le jour venu.
 * 3. **Ce module reste pur.** Il est importé par le bundle navigateur : ni
 *    Prisma, ni `server-only`, ni lecture de fichier. Les intégrations
 *    propres à un runtime vivent dans les trois `sentry.*.config.ts`.
 */

import { scrubEvent } from '@growi/shared'

export type SentryEnvironment = 'production' | 'preview' | 'development'

/** Variables lues, passées explicitement pour rendre le module testable. */
type Env = Record<string, string | undefined>

/**
 * Les variables du build, lues **une par une et littéralement**.
 *
 * Next remplace `process.env.NEXT_PUBLIC_X` par sa valeur au moment du build,
 * mais seulement là où l'expression est écrite telle quelle. Passer
 * `process.env` à une fonction puis l'indexer (`env.NEXT_PUBLIC_SENTRY_DSN`)
 * ne déclenche aucun remplacement : dans le navigateur, `process.env` est
 * alors un objet vide, le DSN vaut `undefined`, et **Sentry ne s'initialise
 * jamais — sans le moindre message**. C'est arrivé, et ça n'a été trouvé
 * qu'en cherchant le DSN dans les chunks du bundle.
 *
 * D'où cet objet : les fonctions ci-dessous gardent leur paramètre `env`
 * (c'est lui qui les rend testables), mais leur valeur par défaut est cette
 * copie-là, bâtie d'accès littéraux. Côté serveur, il est construit au
 * démarrage à partir du vrai `process.env`.
 */
const BUILD_ENV: Env = {
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  NEXT_PUBLIC_VERCEL_ENV: process.env.NEXT_PUBLIC_VERCEL_ENV,
  VERCEL_ENV: process.env.VERCEL_ENV,
  NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,
  VERCEL_GIT_COMMIT_SHA: process.env.VERCEL_GIT_COMMIT_SHA,
}

/**
 * Environnement Sentry, déduit de Vercel.
 *
 * `VERCEL_ENV` n'existe pas dans le bundle navigateur : Next n'y inline que
 * les variables `NEXT_PUBLIC_*`. Vercel expose justement `NEXT_PUBLIC_VERCEL_ENV`
 * pour les projets Next — à condition que la case « Enable access to System
 * Environment Variables » soit cochée — d'où la lecture des deux : la publique
 * d'abord, la privée en repli pour le serveur.
 */
export function resolveEnvironment(env: Env = BUILD_ENV): SentryEnvironment {
  const vercelEnv = env.NEXT_PUBLIC_VERCEL_ENV ?? env.VERCEL_ENV
  if (vercelEnv === 'production') return 'production'
  if (vercelEnv === 'preview') return 'preview'
  return 'development'
}

/**
 * Version déployée : le SHA du commit, que Vercel injecte.
 *
 * C'est ce qui permet de lire « crash-free par release » et de savoir si un
 * correctif a pris. Sans lui, toutes les erreurs se mélangent.
 */
export function resolveRelease(env: Env = BUILD_ENV): string | undefined {
  return env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ?? env.VERCEL_GIT_COMMIT_SHA
}

/**
 * Part des requêtes tracées.
 *
 * 1.0 en preview (peu de trafic, on veut tout voir) et 0.5 en production le
 * temps de la Friends & Family : le plan gratuit plafonne à 5 M de spans par
 * mois, ce qui est très loin devant, mais on baissera après.
 */
export function tracesSampleRate(environment: SentryEnvironment): number {
  return environment === 'production' ? 0.5 : 1
}

/**
 * Socle des trois `Sentry.init`.
 *
 * `dsn` absent vaut « ne pas initialiser » : les configs testent `enabled`
 * avant d'appeler `init`, pour que le SDK ne journalise même pas son absence.
 */
export function baseSentryOptions(env: Env = BUILD_ENV) {
  const environment = resolveEnvironment(env)
  const dsn = env.NEXT_PUBLIC_SENTRY_DSN

  return {
    dsn,
    /** Faux en local et en test : rien ne sort de la machine. */
    enabled: Boolean(dsn) && environment !== 'development',
    environment,
    release: resolveRelease(env),
    tracesSampleRate: tracesSampleRate(environment),
    sendDefaultPii: false,
    initialScope: { tags: { surface: 'web' } },
    beforeSend: scrubEvent,
    beforeSendTransaction: scrubEvent,
  }
}
