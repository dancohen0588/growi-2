/**
 * Vérification des jetons d'identité Apple et Google.
 *
 * Ces jetons sont des JWT signés par le fournisseur. Tout se joue ici : le
 * client peut en présenter n'importe lequel, y compris celui d'une autre app.
 * Trois contrôles le rendent inexploitable — la **signature** (clé publique du
 * fournisseur), l'**émetteur**, et surtout l'**audience**, qui doit être un de
 * nos identifiants clients. Sans ce dernier, n'importe quelle application
 * tierce pourrait faire ouvrir une session Growi avec ses propres jetons.
 */

import { createHash } from 'node:crypto'
import { createRemoteJWKSet, jwtVerify } from 'jose'
import type { SocialProvider } from '@growi/shared'

import { ServiceError } from '@/lib/services/errors'

export interface SocialIdentity {
  provider: SocialProvider
  /** Identifiant stable chez le fournisseur (claim `sub`). */
  subject: string
  email: string | null
  /**
   * Seul un email **vérifié** autorise à rattacher l'identité à un compte
   * existant : sinon, déclarer l'adresse de quelqu'un d'autre suffirait à
   * s'emparer de son jardin.
   */
  emailVerified: boolean
}

const PROVIDERS = {
  apple: {
    label: 'Apple',
    issuer: 'https://appleid.apple.com',
    jwksUrl: 'https://appleid.apple.com/auth/keys',
    /** Identifiant de bundle de l'app (`app.growi.mobile`). */
    clientIdsEnv: 'APPLE_CLIENT_IDS',
  },
  google: {
    label: 'Google',
    // Google émet historiquement sous les deux formes ; les deux sont valides.
    issuer: ['https://accounts.google.com', 'accounts.google.com'],
    jwksUrl: 'https://www.googleapis.com/oauth2/v3/certs',
    /** Un identifiant par plateforme : iOS, Android, et le client web. */
    clientIdsEnv: 'GOOGLE_CLIENT_IDS',
  },
} as const satisfies Record<SocialProvider, unknown>

/**
 * Les jeux de clés sont créés une fois : `jose` les met en cache et ne
 * redemande au fournisseur que lorsqu'une clé inconnue apparaît.
 */
const keySets = {
  apple: createRemoteJWKSet(new URL(PROVIDERS.apple.jwksUrl)),
  google: createRemoteJWKSet(new URL(PROVIDERS.google.jwksUrl)),
}

/** Identifiants clients acceptés, en clair dans l'environnement (ils ne sont pas secrets). */
function audiences(provider: SocialProvider): string[] {
  const raw = process.env[PROVIDERS[provider].clientIdsEnv] ?? ''
  const list = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)

  if (list.length === 0) {
    throw new ServiceError(
      'UNAVAILABLE',
      `La connexion ${PROVIDERS[provider].label} n'est pas configurée sur ce serveur.`,
    )
  }

  return list
}

/** Google sérialise parfois `email_verified` en chaîne ; Apple, toujours. */
function isTrue(claim: unknown): boolean {
  return claim === true || claim === 'true'
}

/**
 * Le fournisseur réinscrit le nonce tel qu'il l'a reçu. Selon les
 * bibliothèques clientes, c'est la valeur brute ou son empreinte SHA-256 qui
 * lui est transmise — les deux sont acceptées, elles désignent le même
 * engagement. Le nonce n'est pas un secret : il n'est là que pour la fraîcheur.
 */
function nonceMatches(claim: string, presented: string): boolean {
  if (claim === presented) return true
  return claim === createHash('sha256').update(presented).digest('hex')
}

/**
 * Vérifie le jeton et en extrait l'identité.
 *
 * @throws ServiceError('UNAUTHENTICATED') — message identique quelle que soit
 * la cause (signature, expiration, audience) : détailler renseignerait qui
 * cherche à forger un jeton.
 * @throws ServiceError('UNAVAILABLE') si le serveur n'a pas d'identifiant client.
 */
export async function verifySocialIdentity(
  provider: SocialProvider,
  identityToken: string,
  nonce?: string,
): Promise<SocialIdentity> {
  const config = PROVIDERS[provider]
  const audience = audiences(provider)

  const refuse = () =>
    new ServiceError('UNAUTHENTICATED', `Connexion ${config.label} refusée.`)

  let payload
  try {
    ;({ payload } = await jwtVerify(identityToken, keySets[provider], {
      issuer: [...(Array.isArray(config.issuer) ? config.issuer : [config.issuer])],
      audience,
    }))
  } catch {
    throw refuse()
  }

  if (typeof payload.sub !== 'string' || payload.sub.length === 0) throw refuse()

  // Un jeton porteur d'un nonce doit être présenté avec celui qu'on a émis.
  // L'absence de nonce des deux côtés reste acceptée : Google protège son
  // échange par PKCE, qui joue le même rôle.
  if (typeof payload.nonce === 'string') {
    if (!nonce || !nonceMatches(payload.nonce, nonce)) throw refuse()
  }

  const email = typeof payload.email === 'string' ? payload.email.toLowerCase() : null

  return {
    provider,
    subject: payload.sub,
    email,
    emailVerified: email !== null && isTrue(payload.email_verified),
  }
}
