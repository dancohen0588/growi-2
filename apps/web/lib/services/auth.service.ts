/**
 * Service d'authentification par jetons (app mobile).
 *
 * Le web conserve sa session NextAuth par cookies : ce service ne le concerne
 * pas. Il émet, rafraîchit et révoque les couples access token / refresh token
 * consommés par `/api/v1/auth/*`.
 */

import type { AuthTokens, AuthUser } from '@growi/shared'

import { prisma } from '@/lib/prisma'
import {
  ACCESS_TOKEN_TTL_SECONDS,
  generateRefreshToken,
  hashRefreshToken,
  refreshTokenExpiry,
  signAccessToken,
} from '@/lib/auth/tokens'
import { ServiceError } from '@/lib/services/errors'
import { createUser, verifyCredentials } from '@/lib/services/user.service'

type UserRow = { id: string; email: string; firstName: string | null; name: string | null }

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
