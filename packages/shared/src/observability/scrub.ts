/**
 * Nettoyage des événements d'observabilité — la barrière aux données
 * personnelles, **partagée par le web et le mobile**.
 *
 * Elle vit ici, et non dans l'une des deux apps, parce qu'un jeu de règles de
 * vie privée écrit deux fois finit par diverger : la moitié qui reçoit le
 * correctif protège, l'autre non, et rien ne le signale. Les deux
 * `beforeSend` importent la même fonction.
 *
 * Ce module ne dépend de rien — pas même des typages du SDK Sentry, dont la
 * forme d'événement est décrite ici structurellement.
 */

/**
 * Clés dont la valeur ne doit jamais quitter l'appareil, quel que soit
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
 * qu'importée du SDK : les deux apps n'ont pas le même paquet Sentry, et ce
 * module n'a pas à choisir entre les deux.
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
