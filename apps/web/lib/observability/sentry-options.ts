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
 * 3. **Ce module reste pur.** Il est importé par le bundle navigateur : ni
 *    Prisma, ni `server-only`, ni lecture de fichier. Les intégrations
 *    propres à un runtime vivent dans les trois `sentry.*.config.ts`.
 */

export type SentryEnvironment = 'production' | 'preview' | 'development'

/** Variables lues, passées explicitement pour rendre le module testable. */
type Env = Record<string, string | undefined>

/**
 * Environnement Sentry, déduit de Vercel.
 *
 * `VERCEL_ENV` n'existe pas dans le bundle navigateur : Next n'y inline que
 * les variables `NEXT_PUBLIC_*`. Vercel expose justement `NEXT_PUBLIC_VERCEL_ENV`
 * pour les projets Next, d'où la lecture des deux — la publique d'abord, la
 * privée en repli pour le serveur.
 */
export function resolveEnvironment(env: Env = process.env): SentryEnvironment {
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
export function resolveRelease(env: Env = process.env): string | undefined {
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

// ─── Nettoyage des événements ──────────────────────────────────────────────

/**
 * Clés dont la valeur ne doit jamais quitter le serveur, quel que soit
 * l'endroit où notre code les a posées. Comparaison sur le nom **contenant**
 * l'un de ces mots : `accessToken`, `user_email` et `passwordHash` doivent
 * tomber aussi.
 */
const SENSITIVE_KEY = /(email|password|token|secret|authorization|cookie)/i

/** Au-delà, on cesse de descendre : une structure profonde est déjà suspecte. */
const MAX_DEPTH = 6

const REDACTED = '[filtré]'

/**
 * Forme minimale d'un événement Sentry — volontairement structurelle plutôt
 * qu'importée du SDK : ce module est chargé par les trois runtimes et par les
 * tests, et n'a pas à dépendre des typages du SDK pour ça.
 */
export type ScrubbableEvent = {
  request?: {
    headers?: Record<string, string>
    cookies?: unknown
    data?: unknown
  }
  extra?: Record<string, unknown>
  contexts?: Record<string, unknown>
}

function redactDeep(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (depth > MAX_DEPTH || value === null || typeof value !== 'object') return value
  if (seen.has(value)) return value
  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((item) => redactDeep(item, depth + 1, seen))
  }

  const out: Record<string, unknown> = {}
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    out[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactDeep(item, depth + 1, seen)
  }
  return out
}

/**
 * Le corps d'une requête d'identification ou de diagnostic porte l'image en
 * base64 : plusieurs mégaoctets, et la photo du jardin de quelqu'un. On la
 * remplace par un marqueur — sa présence est une information utile, son
 * contenu ne l'est pas.
 */
function scrubRequestData(data: unknown): unknown {
  if (typeof data === 'string') {
    return data.includes('imageBase64') ? '[image]' : data
  }
  if (data === null || typeof data !== 'object') return data

  const entries = Object.entries(data as Record<string, unknown>)
  if (!entries.some(([key]) => key === 'imageBase64')) {
    return redactDeep(data, 0, new WeakSet())
  }

  return Object.fromEntries(
    entries.map(([key, value]) =>
      key === 'imageBase64'
        ? [key, '[image]']
        : [key, SENSITIVE_KEY.test(key) ? REDACTED : redactDeep(value, 1, new WeakSet())],
    ),
  )
}

/**
 * Retire d'un événement tout ce qui identifierait une personne.
 *
 * Branché sur `beforeSend` : c'est la dernière barrière avant l'envoi, et la
 * seule qui s'applique aussi aux données jointes par le SDK lui-même.
 */
export function scrubEvent<T extends ScrubbableEvent>(event: T): T {
  if (event.request) {
    const { headers } = event.request
    if (headers) {
      for (const key of Object.keys(headers)) {
        if (SENSITIVE_KEY.test(key)) delete headers[key]
      }
    }
    delete event.request.cookies
    if (event.request.data !== undefined) {
      event.request.data = scrubRequestData(event.request.data)
    }
  }

  if (event.extra) {
    event.extra = redactDeep(event.extra, 0, new WeakSet()) as Record<string, unknown>
  }
  if (event.contexts) {
    event.contexts = redactDeep(event.contexts, 0, new WeakSet()) as Record<string, unknown>
  }

  return event
}

// ─── Options communes ──────────────────────────────────────────────────────

/**
 * Socle des trois `Sentry.init`.
 *
 * `dsn` absent vaut « ne pas initialiser » : les configs testent `enabled`
 * avant d'appeler `init`, pour que le SDK ne journalise même pas son absence.
 */
export function baseSentryOptions(env: Env = process.env) {
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
