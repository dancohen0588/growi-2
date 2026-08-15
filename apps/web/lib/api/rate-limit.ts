/**
 * Limitation de débit en mémoire, pour les endpoints d'authentification.
 *
 * ⚠️ Protection **partielle et provisoire**. Sur Vercel, chaque instance
 * serverless a sa propre mémoire et les instances sont recyclées : un
 * attaquant réparti sur plusieurs instances contourne ce compteur. Elle freine
 * le bourrage d'identifiants naïf et protège le développement local ; un vrai
 * verrou partagé (Upstash Redis ou la couche Vercel) est à mettre en place
 * avant l'ouverture publique — phase 7 du plan.
 */

import { ServiceError } from '@/lib/services/errors'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/** Au-delà, on purge les compteurs expirés pour borner l'empreinte mémoire. */
const CLEANUP_THRESHOLD = 5_000

export interface RateLimitOptions {
  /** Nombre de tentatives autorisées par fenêtre. */
  limit: number
  /** Durée de la fenêtre, en millisecondes. */
  windowMs: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSeconds: number
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions,
  now = Date.now(),
): RateLimitResult {
  if (buckets.size > CLEANUP_THRESHOLD) purgeExpired(now)

  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + options.windowMs })
    return { allowed: true, remaining: options.limit - 1, retryAfterSeconds: 0 }
  }

  bucket.count += 1
  const remaining = Math.max(0, options.limit - bucket.count)

  return {
    allowed: bucket.count <= options.limit,
    remaining,
    retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000),
  }
}

/**
 * Applique la limite et lève si elle est dépassée.
 * @throws ServiceError('RATE_LIMITED') — traduit en 429 par la route.
 */
export function enforceRateLimit(key: string, options: RateLimitOptions): void {
  const result = checkRateLimit(key, options)
  if (!result.allowed) {
    throw new ServiceError(
      'RATE_LIMITED',
      `Trop de tentatives. Réessaie dans ${result.retryAfterSeconds} secondes.`,
    )
  }
}

/**
 * Identifie l'appelant. Derrière Vercel, `x-forwarded-for` est renseigné par
 * la plateforme ; en son absence on retombe sur une clé commune, ce qui rend
 * la limite globale plutôt qu'inopérante.
 */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'inconnu'
  return `${scope}:${ip}`
}

function purgeExpired(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

/** Réinitialise les compteurs — réservé aux tests. */
export function resetRateLimits(): void {
  buckets.clear()
}
