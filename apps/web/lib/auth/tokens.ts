/**
 * Jetons de l'authentification mobile.
 *
 * Deux jetons de natures différentes :
 * - l'**access token** est un JWT signé, de courte durée (15 min), présenté à
 *   chaque requête. Il n'est pas stocké côté serveur : sa validité se vérifie
 *   par la signature seule.
 * - le **refresh token** est opaque (256 bits aléatoires), de longue durée
 *   (60 jours), et n'est stocké en base que sous forme d'empreinte SHA-256 —
 *   une fuite de la base ne permet donc pas de rejouer une session.
 */

import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { SignJWT, jwtVerify, type JWTPayload } from 'jose'

import { ServiceError } from '@/lib/services/errors'

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
export const REFRESH_TOKEN_TTL_DAYS = 60

/** Émetteur et audience, pour qu'un JWT d'un autre service ne soit pas accepté. */
const JWT_ISSUER = 'growi'
const JWT_AUDIENCE = 'growi-mobile'

/**
 * Clé de signature des access tokens.
 *
 * Volontairement distincte du secret NextAuth : compromettre les sessions web
 * ne doit pas permettre de forger des jetons mobiles, et inversement.
 */
function getSigningKey(): Uint8Array {
  const secret = process.env.JWT_SECRET
  if (!secret) {
    throw new ServiceError(
      'INTERNAL',
      "JWT_SECRET n'est pas défini : l'authentification mobile est indisponible.",
    )
  }
  return new TextEncoder().encode(secret)
}

export async function signAccessToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(getSigningKey())
}

/**
 * Vérifie un access token et renvoie l'identifiant de son porteur.
 * @throws ServiceError('UNAUTHENTICATED') si le jeton est invalide ou expiré.
 */
export async function verifyAccessToken(token: string): Promise<string> {
  let payload: JWTPayload
  try {
    ;({ payload } = await jwtVerify(token, getSigningKey(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }))
  } catch {
    // On ne distingue pas expiration, signature invalide et jeton malformé :
    // le client n'a rien à en faire, et le détail renseignerait un attaquant.
    throw new ServiceError('UNAUTHENTICATED', 'Jeton invalide ou expiré')
  }

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) {
    throw new ServiceError('UNAUTHENTICATED', 'Jeton invalide ou expiré')
  }
  return payload.sub
}

/** Jeton de rafraîchissement opaque : 256 bits d'aléa, encodés en base64url. */
export function generateRefreshToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Empreinte stockée en base. SHA-256 suffit : l'entrée est déjà de l'aléa pur. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Comparaison à temps constant de deux empreintes. */
export function refreshTokenHashEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8')
  const bufB = Buffer.from(b, 'utf8')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function refreshTokenExpiry(from = new Date()): Date {
  return new Date(from.getTime() + REFRESH_TOKEN_TTL_DAYS * 86_400_000)
}

/** Extrait le jeton d'un en-tête `Authorization: Bearer …`, ou `null`. */
export function parseBearerToken(header: string | null | undefined): string | null {
  if (!header) return null
  const match = /^Bearer\s+(.+)$/i.exec(header.trim())
  return match ? match[1].trim() : null
}
