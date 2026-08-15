/**
 * Service utilisateur — compte, profil, préférences d'alertes.
 */

import type { UpdateAlertConfigInput, UpdateProfileInput } from '@growi/shared'
import { DEFAULT_ALERT_CONFIG, type AlertConfig, type UserProfile } from '@growi/shared'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'
import { ServiceError } from '@/lib/services/errors'

const PROFILE_SELECT = {
  firstName: true,
  lastName: true,
  name: true,
  email: true,
  address: true,
  gardenType: true,
  avatarColor: true,
  alertConfig: true,
  latitude: true,
  longitude: true,
} as const

type ProfileRow = {
  firstName: string | null
  lastName: string | null
  name: string | null
  email: string
  address: string | null
  gardenType: string | null
  avatarColor: string | null
  alertConfig: Prisma.JsonValue | null
  latitude: number | null
  longitude: number | null
}

/** Ligne Prisma → profil exposé au client. */
export function toProfile(user: ProfileRow): UserProfile {
  return {
    firstName: user.firstName ?? user.name ?? '',
    lastName: user.lastName ?? '',
    email: user.email,
    address: user.address ?? undefined,
    avatarColor: user.avatarColor ?? undefined,
    gardenType: (user.gardenType ?? undefined) as UserProfile['gardenType'],
    alertConfig: (user.alertConfig as AlertConfig | null) ?? DEFAULT_ALERT_CONFIG,
    latitude: user.latitude,
    longitude: user.longitude,
  }
}

/** @throws ServiceError('NOT_FOUND') si le compte n'existe plus. */
export async function getProfile(userId: string): Promise<UserProfile> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PROFILE_SELECT,
  })
  if (!user) throw new ServiceError('NOT_FOUND', 'Utilisateur introuvable')
  return toProfile(user)
}

/** @throws ServiceError('CONFLICT') si l'email est déjà pris. */
export async function updateProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<UserProfile> {
  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: input,
      select: PROFILE_SELECT,
    })
    return toProfile(updated)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ServiceError('CONFLICT', 'Cet email est déjà utilisé.')
    }
    throw err
  }
}

/** Localisation de l'utilisateur, pour la météo et les conseils. */
export async function getUserLocation(userId: string) {
  return prisma.user.findUnique({
    where: { id: userId },
    select: { address: true, latitude: true, longitude: true },
  })
}

// ─── Préférences d'alertes ─────────────────────────────────────────────────

export async function getAlertConfig(userId: string): Promise<AlertConfig> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { alertConfig: true },
  })
  return {
    ...DEFAULT_ALERT_CONFIG,
    ...((user?.alertConfig as AlertConfig | null) ?? {}),
  }
}

/** Fusionne les préférences reçues avec l'existant et les valeurs par défaut. */
export async function updateAlertConfig(
  userId: string,
  input: UpdateAlertConfigInput,
): Promise<AlertConfig> {
  const current = await prisma.user.findUnique({
    where: { id: userId },
    select: { alertConfig: true },
  })

  const merged: AlertConfig = {
    ...DEFAULT_ALERT_CONFIG,
    ...((current?.alertConfig as AlertConfig | null) ?? {}),
    ...input,
  }

  await prisma.user.update({
    where: { id: userId },
    data: { alertConfig: merged as unknown as Prisma.InputJsonValue },
  })

  return merged
}

// ─── Compte et mot de passe ────────────────────────────────────────────────

/**
 * Crée un compte à partir d'un email et d'un mot de passe.
 * @throws ServiceError('CONFLICT') si un compte existe déjà avec cet email.
 */
export async function createUser(input: {
  email: string
  password: string
  firstName: string
}): Promise<{ id: string }> {
  const hashedPassword = await bcrypt.hash(input.password, 12)

  try {
    return await prisma.user.create({
      data: {
        email: input.email,
        name: input.firstName,
        password: hashedPassword,
      },
      select: { id: true },
    })
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ServiceError('CONFLICT', 'Un compte existe déjà avec cet email.')
    }
    throw err
  }
}

/**
 * Change le mot de passe après vérification de l'actuel.
 * @throws ServiceError('INVALID_INPUT') si le compte n'a pas de mot de passe
 * (connexion sociale), ServiceError('UNAUTHENTICATED') si l'actuel est faux.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true },
  })

  if (!user?.password) {
    throw new ServiceError('INVALID_INPUT', 'Aucun mot de passe défini sur ce compte.')
  }

  const ok = await bcrypt.compare(currentPassword, user.password)
  if (!ok) {
    throw new ServiceError('UNAUTHENTICATED', 'Mot de passe actuel incorrect.')
  }

  const hashed = await bcrypt.hash(newPassword, 12)
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  })
}

/**
 * Vérifie un couple email / mot de passe.
 * Renvoie l'utilisateur si les identifiants sont valides, `null` sinon —
 * jamais de distinction entre « compte inconnu » et « mot de passe faux ».
 */
export async function verifyCredentials(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } })

  // Une comparaison bcrypt est toujours effectuée, même quand le compte
  // n'existe pas : sans ce leurre, la réponse serait nettement plus rapide
  // pour un email inconnu, ce qui permettrait de découvrir quels emails sont
  // enregistrés — et annulerait l'effort fait sur des messages indistincts.
  const hash = user?.password ?? DUMMY_PASSWORD_HASH
  const passwordsMatch = await bcrypt.compare(password, hash)

  if (!user?.password || !passwordsMatch) return null
  return user
}

/**
 * Empreinte d'un mot de passe qui n'est celui de personne, au même coût
 * bcrypt (12 tours) que les vrais.
 */
const DUMMY_PASSWORD_HASH =
  '$2a$12$oPYUp2CEv4iYPUREbWrWu.Ql4vNfnpN5D38veu/SPzkzOCK33clzy'
