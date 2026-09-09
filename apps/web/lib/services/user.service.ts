/**
 * Service utilisateur — compte, profil, préférences d'alertes.
 */

import type { UpdateAlertConfigInput, UpdateProfileInput } from '@growi/shared'
import { DEFAULT_ALERT_CONFIG, type AlertConfig, type UserProfile } from '@growi/shared'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'

import { prisma } from '@/lib/prisma'
import { invalidateGardenAdviceCache } from '@/lib/recommendation/garden-advice-service'
import { refreshFuzzyPosition } from '@/lib/services/community/profile.service'
import { ServiceError } from '@/lib/services/errors'

const PROFILE_SELECT = {
  id: true,
  firstName: true,
  lastName: true,
  name: true,
  email: true,
  address: true,
  locationCity: true,
  gardenType: true,
  avatarColor: true,
  alertConfig: true,
  latitude: true,
  longitude: true,
  analyticsOptOut: true,
} as const

type ProfileRow = {
  id: string
  firstName: string | null
  lastName: string | null
  name: string | null
  email: string
  address: string | null
  locationCity: string | null
  gardenType: string | null
  avatarColor: string | null
  alertConfig: Prisma.JsonValue | null
  latitude: number | null
  longitude: number | null
  analyticsOptOut: boolean
}

/** Ligne Prisma → profil exposé au client. */
export function toProfile(user: ProfileRow): UserProfile {
  return {
    id: user.id,
    firstName: user.firstName ?? user.name ?? '',
    lastName: user.lastName ?? '',
    email: user.email,
    address: user.address ?? undefined,
    city: user.locationCity ?? undefined,
    avatarColor: user.avatarColor ?? undefined,
    gardenType: (user.gardenType ?? undefined) as UserProfile['gardenType'],
    // Fusion, et non repli : une configuration enregistrée avant l'ajout d'une
    // clé (`community`) la rendrait sinon absente du profil, et le réglage
    // correspondant s'afficherait vide au lieu de sa valeur par défaut.
    alertConfig: {
      ...DEFAULT_ALERT_CONFIG,
      ...((user.alertConfig as AlertConfig | null) ?? {}),
    },
    latitude: user.latitude,
    longitude: user.longitude,
    analyticsOptOut: user.analyticsOptOut,
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
  // `city` est exposée sous ce nom mais stockée en `locationCity`.
  const { city, ...rest } = input

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { ...rest, ...(city !== undefined ? { locationCity: city } : {}) },
      select: PROFILE_SELECT,
    })

    // Les conseils sont calculés avec la météo du lieu : déménager doit les
    // refaire, sans quoi l'utilisateur renseigne sa ville et ne voit rien
    // changer pendant six heures.
    //
    // La position floutée de la communauté suit le même déménagement : la
    // laisser sur l'ancienne commune ferait afficher des distances fausses aux
    // voisins, et rangerait les publications au mauvais endroit.
    if (input.latitude !== undefined || input.longitude !== undefined) {
      const gardens = await prisma.garden.findMany({ where: { userId }, select: { id: true } })
      await Promise.all([
        ...gardens.map((garden) => invalidateGardenAdviceCache(garden.id)),
        refreshFuzzyPosition(userId, updated.latitude, updated.longitude),
      ])
    }

    return toProfile(updated)
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ServiceError('CONFLICT', 'Cet email est déjà utilisé.')
    }
    throw err
  }
}

/**
 * Fuseau de l'utilisateur — celui dans lequel se compte « aujourd'hui ».
 *
 * Le planning et le quota du chat en dépendent : en UTC, la journée d'un
 * Français bascule à 2 h du matin, au milieu de sa soirée.
 */
export async function getUserTimezone(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  })
  return user?.timezone ?? 'Europe/Paris'
}

/**
 * Le compte refuse-t-il l'analyse d'usage ?
 *
 * Lu à part du profil complet : le layout du dashboard n'a besoin que de ce
 * booléen, et le charger avec le reste ferait une requête plus large sur
 * chaque page. En cas de compte introuvable, on répond « refuse » — le silence
 * est le repli sûr.
 */
export async function getAnalyticsOptOut(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { analyticsOptOut: true },
  })
  return user?.analyticsOptOut ?? true
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
 * jamais de distinction entre « compte inconnu », « mot de passe faux » et
 * « compte désactivé ».
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
  // Un compte désactivé se comporte comme un mot de passe faux : lui répondre
  // « votre compte est désactivé » indiquerait aussi que l'adresse existe et
  // que le mot de passe présenté était le bon.
  if (user.disabledAt) return null
  return user
}

/**
 * Empreinte d'un mot de passe qui n'est celui de personne, au même coût
 * bcrypt (12 tours) que les vrais.
 */
const DUMMY_PASSWORD_HASH =
  '$2a$12$oPYUp2CEv4iYPUREbWrWu.Ql4vNfnpN5D38veu/SPzkzOCK33clzy'
