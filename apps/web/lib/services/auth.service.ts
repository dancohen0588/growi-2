/**
 * Service d'authentification par jetons (app mobile).
 *
 * Le web conserve sa session NextAuth par cookies : ce service ne le concerne
 * pas. Il émet, rafraîchit et révoque les couples access token / refresh token
 * consommés par `/api/v1/auth/*`.
 */

import { randomUUID } from 'node:crypto'
import { Prisma } from '@prisma/client'
import type { AuthTokens, AuthUser, SocialLoginInput, SocialProvider } from '@growi/shared'

import { prisma } from '@/lib/prisma'
import {
  ACCESS_TOKEN_TTL_SECONDS,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from '@/lib/auth/tokens'
import { verifySocialIdentity } from '@/lib/auth/social-identity'
import { ServiceError } from '@/lib/services/errors'
import { createUser, verifyCredentials } from '@/lib/services/user.service'

type UserRow = { id: string; email: string; firstName: string | null; name: string | null }

/** Les seuls champs dont l'émission de jetons a besoin. */
const USER_FIELDS = { id: true, email: true, firstName: true, name: true } as const

function toAuthUser(user: UserRow): AuthUser {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName ?? user.name,
  }
}

/** Émet un couple de jetons et enregistre l'empreinte du refresh token. */
async function issueTokens(user: UserRow, deviceInfo?: string): Promise<AuthTokens> {
  const refreshToken = generateRefreshToken()

  await prisma.refreshToken.create({
    data: {
      tokenHash: hashRefreshToken(refreshToken),
      userId: user.id,
      deviceInfo: deviceInfo ?? null,
      expiresAt: refreshTokenExpiry(),
    },
  })

  return {
    accessToken: await signAccessToken(user.id),
    refreshToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: toAuthUser(user),
  }
}

/**
 * Crée un compte et ouvre une session.
 * @throws ServiceError('CONFLICT') si l'email est déjà pris.
 */
export async function register(input: {
  email: string
  password: string
  firstName: string
  deviceInfo?: string
}): Promise<AuthTokens> {
  const { id } = await createUser({
    email: input.email,
    password: input.password,
    firstName: input.firstName,
  })

  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    select: { id: true, email: true, firstName: true, name: true },
  })

  return issueTokens(user, input.deviceInfo)
}

/**
 * Ouvre une session à partir d'un email et d'un mot de passe.
 * @throws ServiceError('UNAUTHENTICATED') — message volontairement identique
 * que le compte soit inconnu ou le mot de passe faux, pour ne pas révéler
 * quels emails sont enregistrés.
 */
export async function login(input: {
  email: string
  password: string
  deviceInfo?: string
}): Promise<AuthTokens> {
  const user = await verifyCredentials(input.email, input.password)
  if (!user) {
    throw new ServiceError('UNAUTHENTICATED', 'Email ou mot de passe incorrect')
  }
  return issueTokens(user, input.deviceInfo)
}

/**
 * Ouvre une session à partir d'un jeton Apple ou Google.
 *
 * Trois chemins, dans cet ordre :
 * 1. l'identité est déjà rattachée à un compte — on le reconnaît ;
 * 2. l'email est **vérifié** et correspond à un compte existant — on rattache,
 *    ce qui évite un doublon à qui s'était inscrit par mot de passe ;
 * 3. sinon, on crée un compte sans mot de passe.
 *
 * Le rattachement par email n'est tenté que si le fournisseur atteste
 * l'adresse : accepter une adresse non vérifiée reviendrait à laisser prendre
 * le compte de quelqu'un en la déclarant.
 *
 * @throws ServiceError('UNAUTHENTICATED') si le jeton ne vaut rien.
 */
export async function loginWithProvider(
  provider: SocialProvider,
  input: SocialLoginInput,
): Promise<AuthTokens> {
  const identity = await verifySocialIdentity(provider, input.identityToken, input.nonce)

  const linked = await prisma.account.findUnique({
    where: { provider_providerAccountId: { provider, providerAccountId: identity.subject } },
    select: { user: { select: USER_FIELDS } },
  })

  if (linked) return issueTokens(linked.user, input.deviceInfo)

  const label = provider === 'apple' ? 'Apple' : 'Google'

  if (!identity.email) {
    // Apple laisse masquer l'adresse, mais fournit alors un relais. Sans email
    // du tout, on n'a pas de quoi tenir un compte.
    throw new ServiceError(
      'UNAUTHENTICATED',
      `Connexion ${label} refusée : aucune adresse email transmise.`,
    )
  }

  if (identity.emailVerified) {
    const existing = await prisma.user.findUnique({
      where: { email: identity.email },
      select: USER_FIELDS,
    })

    if (existing) {
      await linkAccount(existing.id, provider, identity.subject)
      return issueTokens(existing, input.deviceInfo)
    }
  }

  const displayName = [input.firstName, input.lastName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(' ')

  let created: UserRow
  try {
    created = await prisma.user.create({
      data: {
        email: identity.email,
        // Pas de mot de passe : ce compte n'a d'autre porte que son
        // fournisseur, tant que son porteur n'en définit pas un.
        name: displayName || null,
        firstName: input.firstName?.trim() || null,
        lastName: input.lastName?.trim() || null,
        // L'adresse ne compte pour vérifiée que si le fournisseur l'atteste.
        emailVerified: identity.emailVerified ? new Date() : null,
      },
      select: USER_FIELDS,
    })
  } catch (err) {
    // L'adresse est déjà prise et le fournisseur ne la garantit pas : on
    // refuse plutôt que de rattacher. Déclarer l'adresse d'un tiers suffirait
    // sinon à entrer dans son jardin.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ServiceError(
        'CONFLICT',
        `Un compte existe déjà avec cette adresse. Connecte-toi avec ton mot de passe, ${label} pourra être rattaché ensuite.`,
      )
    }
    throw err
  }

  await linkAccount(created.id, provider, identity.subject)
  return issueTokens(created, input.deviceInfo)
}

/**
 * Rattache l'identité au compte.
 *
 * `Account` vient de NextAuth, dont l'adaptateur fournit lui-même la clé
 * primaire : le modèle n'a pas de valeur par défaut, il faut donc l'écrire.
 */
async function linkAccount(
  userId: string,
  provider: SocialProvider,
  providerAccountId: string,
): Promise<void> {
  await prisma.account.create({
    data: { id: randomUUID(), userId, type: 'oidc', provider, providerAccountId },
  })
}

/**
 * Échange un refresh token contre un nouveau couple, avec rotation :
 * l'ancien jeton est révoqué dans la même transaction que l'émission du
 * nouveau.
 *
 * Si un jeton **déjà révoqué** est présenté, c'est le signe qu'il a fuité et
 * qu'il est rejoué : toutes les sessions de l'utilisateur sont alors révoquées.
 *
 * @throws ServiceError('UNAUTHENTICATED')
 */
export async function refresh(
  presentedToken: string,
  deviceInfo?: string,
): Promise<AuthTokens> {
  const tokenHash = hashRefreshToken(presentedToken)

  const stored = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: {
      user: { select: { id: true, email: true, firstName: true, name: true } },
    },
  })

  if (!stored) {
    throw new ServiceError('UNAUTHENTICATED', 'Jeton de rafraîchissement invalide')
  }

  if (stored.revokedAt) {
    // Rejeu détecté : on coupe toutes les sessions de l'utilisateur.
    await revokeAllForUser(stored.userId)
    throw new ServiceError('UNAUTHENTICATED', 'Jeton de rafraîchissement invalide')
  }

  if (stored.expiresAt <= new Date()) {
    throw new ServiceError('UNAUTHENTICATED', 'Jeton de rafraîchissement expiré')
  }

  const newToken = generateRefreshToken()

  await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    }),
    prisma.refreshToken.create({
      data: {
        tokenHash: hashRefreshToken(newToken),
        userId: stored.userId,
        deviceInfo: deviceInfo ?? stored.deviceInfo,
        expiresAt: refreshTokenExpiry(),
      },
    }),
  ])

  return {
    accessToken: await signAccessToken(stored.userId),
    refreshToken: newToken,
    tokenType: 'Bearer',
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
    user: toAuthUser(stored.user),
  }
}

/**
 * Ferme la session portée par ce refresh token.
 *
 * Idempotent : un jeton inconnu ou déjà révoqué ne provoque pas d'erreur —
 * une déconnexion ne doit jamais échouer côté client.
 */
export async function logout(presentedToken: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hashRefreshToken(presentedToken), revokedAt: null },
    data: { revokedAt: new Date() },
  })
}

/** Révoque toutes les sessions actives d'un utilisateur. */
export async function revokeAllForUser(userId: string): Promise<number> {
  const { count } = await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  })
  return count
}

/**
 * Supprime les jetons expirés ou révoqués depuis longtemps.
 * Destiné à une tâche planifiée ; la table grossit sinon indéfiniment.
 */
export async function purgeStaleRefreshTokens(olderThan = new Date()): Promise<number> {
  const { count } = await prisma.refreshToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: olderThan } }, { revokedAt: { lt: olderThan } }],
    },
  })
  return count
}
