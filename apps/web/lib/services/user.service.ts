/**
 * Service utilisateur — compte, profil, préférences d'alertes.
 */

import type { AuthMethod, UpdateAlertConfigInput, UpdateProfileInput } from '@growi/shared'
import {
  DEFAULT_ALERT_CONFIG,
  LEGAL_VERSION,
  type AlertConfig,
  type UserProfile,
} from '@growi/shared'
import { Prisma } from '@prisma/client'
import bcrypt from 'bcryptjs'

import {
  rememberConsent,
  setPersonProperties,
  trackAnonymous,
  trackServer,
} from '@/lib/analytics/server'
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
  analyticsConsent: true,
  analyticsConsentAt: true,
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
  analyticsConsent: boolean | null
  analyticsConsentAt: Date | null
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
    analyticsConsent: user.analyticsConsent,
    analyticsConsentAt: user.analyticsConsentAt?.toISOString() ?? null,
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
  const { city, analyticsConsent, ...rest } = input

  // L'état d'avant n'est lu que si le choix change : c'est lui qui dit si
  // l'inscription reste à rejouer (voir `replaySignupOnConsent`).
  const before =
    analyticsConsent !== undefined
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { analyticsConsent: true, termsAcceptedAt: true },
        })
      : null

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...rest,
        ...(city !== undefined ? { locationCity: city } : {}),
        // La date accompagne chaque réponse, y compris une réponse identique :
        // c'est la preuve du dernier choix exprimé, pas du dernier changement.
        ...(analyticsConsent !== undefined
          ? { analyticsConsent, analyticsConsentAt: new Date() }
          : {}),
      },
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

    // Le choix prend effet sur cette instance à l'instant, sans attendre que
    // la mémoire d'une heure expire : l'événement `care_logged` qui suivrait
    // un retrait dans la même minute ne partirait pas.
    if (analyticsConsent !== undefined) {
      rememberConsent(userId, updated.analyticsConsent)
      if (analyticsConsent && before) await replaySignupOnConsent(userId, before)
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
 * Rejoue l'inscription dans la mesure d'usage, au premier « oui ».
 *
 * `signup_completed` est émis à la création du compte — donc avant que la
 * question du consentement ait pu être posée, et il se tait. Sans ce rattrapage,
 * l'entonnoir d'activation n'aurait plus de première marche. L'événement est
 * daté de l'inscription réelle : c'est un fait survenu, rapporté une fois
 * l'accord obtenu.
 *
 * Seulement à la **première** réponse d'un compte créé sous ce régime
 * (`termsAcceptedAt` posé) : les comptes plus anciens ont déjà émis le leur
 * quand la mesure était en opt-out, et un « non » suivi d'un « oui » ne doit
 * pas l'envoyer deux fois. Qui dit non puis oui perd l'événement, pas les
 * propriétés de personne — réécrites à chaque oui, elles sont idempotentes.
 */
async function replaySignupOnConsent(
  userId: string,
  before: { analyticsConsent: boolean | null; termsAcceptedAt: Date | null },
): Promise<void> {
  if (before.analyticsConsent === true) return

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { createdAt: true, password: true, accounts: { select: { provider: true }, take: 1 } },
  })
  if (!user) return

  const method: AuthMethod = user.password
    ? 'email'
    : ((user.accounts[0]?.provider ?? 'email') as AuthMethod)

  setPersonProperties(userId, { signup_method: method, signup_at: user.createdAt.toISOString() })

  if (before.analyticsConsent === null && before.termsAcceptedAt) {
    trackServer(userId, 'signup_completed', { method }, { timestamp: user.createdAt })
  }
}

/*
 * OBS-delete-person — à faire le jour où la suppression de compte existe.
 *
 * Supprimer un compte doit aussi effacer la personne dans PostHog et détacher
 * l'identité côté Sentry : sans cela, un compte parti continuerait d'exister
 * chez deux prestataires, et la page de confidentialité promettrait quelque
 * chose de faux. La fonction n'existe pas encore (elle vient avec le chantier
 * « suppression de compte » demandé par Google Play) ; ce commentaire marque
 * l'endroit où le raccrocher, à côté des autres écritures sur le compte.
 */

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
 * Le choix du compte quant à la mesure d'usage : `null` tant que la question
 * n'a pas été posée.
 *
 * Lu à part du profil complet : le layout du dashboard n'a besoin que de cette
 * valeur, et la charger avec le reste ferait une requête plus large sur chaque
 * page. Un compte introuvable vaut refus, pas « jamais demandé » : on ne pose
 * pas la question à un compte qui n'existe plus.
 */
export async function getAnalyticsConsent(userId: string): Promise<boolean | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { analyticsConsent: true },
  })
  return user ? user.analyticsConsent : false
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
 * Trace de l'acceptation des textes légaux, à poser **à la création** du
 * compte seulement — par email ou au premier passage Apple/Google. Une
 * reconnexion n'accepte rien de nouveau ; les comptes antérieurs restent à
 * `null`, on ne fabrique pas une acceptation qui n'a pas eu lieu.
 */
export function termsAcceptance(now = new Date()) {
  return { termsAcceptedAt: now, termsVersion: LEGAL_VERSION }
}

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
    const created = await prisma.user.create({
      data: {
        email: input.email,
        name: input.firstName,
        password: hashedPassword,
        // L'inscription vaut acceptation des CGU et de la politique : la
        // mention figure sous le bouton, la trace est ici.
        ...termsAcceptance(),
      },
      select: { id: true },
    })

    /*
     * L'événement est émis **ici**, et non dans `auth.service.register()`.
     *
     * Deux parcours créent un compte par mot de passe : l'API v1 (mobile) et
     * la Server Action `registerAction` (web). Posé dans le service d'auth, il
     * ne couvrait que le premier — le web s'inscrivait sans laisser de trace,
     * et l'entonnoir d'activation restait vide sans que rien ne le signale.
     * `createUser` est le seul point que les deux traversent.
     */
    trackServer(created.id, 'signup_completed', { method: 'email' })
    setPersonProperties(created.id, {
      signup_method: 'email',
      signup_at: new Date().toISOString(),
    })

    return created
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

  /*
   * Comme pour l'inscription, la mesure est posée au point de passage commun :
   * NextAuth (web) et `auth.service.login()` (mobile) appellent tous deux
   * cette fonction. L'échec ne se rattache à personne — même quand le compte
   * existe, le dire reviendrait à confirmer que l'adresse est enregistrée.
   */
  if (!user?.password || !passwordsMatch) {
    trackAnonymous('login_failed', { method: 'email', reason: 'bad_credentials' })
    return null
  }

  // Un compte désactivé se comporte comme un mot de passe faux : lui répondre
  // « votre compte est désactivé » indiquerait aussi que l'adresse existe et
  // que le mot de passe présenté était le bon.
  if (user.disabledAt) {
    trackAnonymous('login_failed', { method: 'email', reason: 'account_disabled' })
    return null
  }

  trackServer(user.id, 'login_completed', { method: 'email' })
  return user
}

/**
 * Empreinte d'un mot de passe qui n'est celui de personne, au même coût
 * bcrypt (12 tours) que les vrais.
 */
const DUMMY_PASSWORD_HASH =
  '$2a$12$oPYUp2CEv4iYPUREbWrWu.Ql4vNfnpN5D38veu/SPzkzOCK33clzy'
