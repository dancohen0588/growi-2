/**
 * Service utilisateur — compte, profil, préférences d'alertes.
 */

import type {
  AuthMethod,
  DeleteAccountInput,
  UpdateAlertConfigInput,
  UpdateProfileInput,
} from '@growi/shared'
import {
  DEFAULT_ALERT_CONFIG,
  DELETE_ACCOUNT_CONFIRMATION,
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
import { deletePostHogPerson } from '@/lib/analytics/posthog-admin'
import { prisma } from '@/lib/prisma'
import { invalidateGardenAdviceCache } from '@/lib/recommendation/garden-advice-service'
import { refreshFuzzyPosition } from '@/lib/services/community/profile.service'
import { ServiceError } from '@/lib/services/errors'
import { deletePhotosByUrl, deleteUserFolder } from '@/lib/storage'

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
  // Lu pour en déduire `hasPassword`, jamais recopié : `toProfile` construit
  // son résultat champ par champ.
  password: true,
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
  password: string | null
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
    hasPassword: user.password !== null,
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

// ─── Suppression du compte ─────────────────────────────────────────────────

/** Une connexion Apple/Google plus ancienne ne suffit plus à supprimer le compte. */
export const RECENT_LOGIN_MAX_AGE_MS = 10 * 60 * 1000

/**
 * Supprime un compte et tout ce qui s'y rattache — droit à l'effacement
 * (RGPD art. 17), et exigence des deux boutiques.
 *
 * **La preuve de présence** : le mot de passe pour un compte qui en a un ;
 * pour un compte Apple/Google, une connexion de moins de dix minutes
 * (`authenticatedAt`, lu dans le jeton par la route — voir `signAccessToken`).
 * Une session ouverte ne suffit pas : un téléphone prêté ou un jeton volé
 * n'ont pas à pouvoir effacer un jardin.
 *
 * **L'ordre** :
 * 1. relever ce que la cascade va emporter chez **d'autres** comptes — les
 *    compteurs à recalculer, les photos qu'ils ont postées dans les fils des
 *    annonces supprimées ;
 * 2. en une transaction : effacer les notifications que ce compte a
 *    déclenchées (leur texte figé porte son pseudo), supprimer la ligne
 *    `users` — la base fait la cascade —, recalculer les compteurs touchés ;
 * 3. hors transaction et sans jamais échouer : vider son dossier de photos,
 *    les photos relevées, et sa personne PostHog.
 *
 * Restent, par choix : les messages de contact (`SetNull`, historique du
 * support) et le journal d'audit des administrateurs (`SetNull`).
 *
 * @throws ServiceError('INVALID_INPUT') sans confirmation,
 * ServiceError('UNAUTHENTICATED') sans preuve de présence,
 * ServiceError('FORBIDDEN') pour le dernier administrateur,
 * ServiceError('NOT_FOUND') si le compte n'existe plus.
 */
export async function deleteAccount(
  userId: string,
  input: DeleteAccountInput,
  options: { authenticatedAt?: Date | null; now?: Date } = {},
): Promise<void> {
  if (input.confirmation !== DELETE_ACCOUNT_CONFIRMATION) {
    throw new ServiceError('INVALID_INPUT', `Tape ${DELETE_ACCOUNT_CONFIRMATION} pour confirmer.`)
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { password: true, role: true },
  })
  if (!user) throw new ServiceError('NOT_FOUND', 'Compte introuvable.')

  await assertPresence(user.password, input.password, options)

  // Même règle que pour la rétrogradation (`lib/admin/roles.ts`) : sans
  // administrateur, `/admin` devient inaccessible et il faut la base de
  // production pour en sortir.
  if (user.role === 'ADMIN') {
    const admins = await prisma.user.count({ where: { role: 'ADMIN' } })
    if (admins <= 1) {
      throw new ServiceError(
        'FORBIDDEN',
        'Nomme un autre administrateur avant de supprimer ce compte.',
      )
    }
  }

  const affected = await collectAffected(userId)

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { actorId: userId } })
    await tx.user.delete({ where: { id: userId } })
    await recountAfterDeletion(tx, affected)
  })

  await Promise.all([
    deleteUserFolder(userId),
    deletePhotosByUrl(affected.foreignPhotoUrls),
    deletePostHogPerson(userId),
  ])
}

async function assertPresence(
  hash: string | null,
  password: string | undefined,
  options: { authenticatedAt?: Date | null; now?: Date },
): Promise<void> {
  if (hash) {
    if (!password || !(await bcrypt.compare(password, hash))) {
      throw new ServiceError('UNAUTHENTICATED', 'Mot de passe incorrect.')
    }
    return
  }

  const now = options.now ?? new Date()
  const loggedInAt = options.authenticatedAt
  if (!loggedInAt || now.getTime() - loggedInAt.getTime() > RECENT_LOGIN_MAX_AGE_MS) {
    throw new ServiceError('UNAUTHENTICATED', 'Reconnecte-toi pour supprimer ton compte.')
  }
}

type AffectedByDeletion = {
  /** Comptes que celui-ci suivait : leur `followerCount` baisse. */
  followedIds: string[]
  /** Comptes qui le suivaient : leur `followingCount` baisse. */
  followerIds: string[]
  /** Publications d'autrui qu'il a aimées ou commentées. */
  postIds: string[]
  /** Annonces d'autrui sur lesquelles il avait ouvert un fil. */
  listingIds: string[]
  /** Photos postées par d'autres dans les fils de ses annonces. */
  foreignPhotoUrls: string[]
}

/**
 * Ce que la cascade va toucher hors de ce compte, relevé **avant** : une fois
 * les lignes supprimées, plus rien ne dit quels compteurs ont bougé.
 */
async function collectAffected(userId: string): Promise<AffectedByDeletion> {
  const [following, followers, likes, comments, threads, foreignMessages] = await Promise.all([
    prisma.follow.findMany({ where: { followerId: userId }, select: { followingId: true } }),
    prisma.follow.findMany({ where: { followingId: userId }, select: { followerId: true } }),
    prisma.postLike.findMany({
      where: { userId, post: { userId: { not: userId } } },
      select: { postId: true },
    }),
    prisma.comment.findMany({
      where: { userId, post: { userId: { not: userId } } },
      select: { postId: true },
      distinct: ['postId'],
    }),
    prisma.listingThread.findMany({
      where: { requesterId: userId, listing: { userId: { not: userId } } },
      select: { listingId: true },
    }),
    // Ses propres photos sont dans son dossier ; celles des autres non.
    prisma.listingMessage.findMany({
      where: {
        thread: { listing: { userId } },
        userId: { not: userId },
        photoUrl: { not: null },
      },
      select: { photoUrl: true },
    }),
  ])

  return {
    followedIds: following.map((f) => f.followingId),
    followerIds: followers.map((f) => f.followerId),
    postIds: [...new Set([...likes, ...comments].map((row) => row.postId))],
    listingIds: [...new Set(threads.map((t) => t.listingId))],
    foreignPhotoUrls: foreignMessages.flatMap((m) => (m.photoUrl ? [m.photoUrl] : [])),
  }
}

/**
 * Recompte, plutôt que décrémenter, les compteurs dénormalisés touchés : la
 * valeur juste est celle des lignes restantes, et un compteur qui avait
 * dérivé en sort corrigé au lieu d'être décalé d'autant.
 *
 * En SQL : une requête par compteur au lieu d'une par ligne. Mêmes règles de
 * comptage que les services qui les tiennent — un commentaire `deleted` ne
 * compte plus, un commentaire masqué si (`post.service.deleteComment`).
 */
async function recountAfterDeletion(
  tx: Prisma.TransactionClient,
  affected: AffectedByDeletion,
): Promise<void> {
  if (affected.followedIds.length) {
    await tx.$executeRaw`
      UPDATE "users" u
      SET "followerCount" = (SELECT COUNT(*)::int FROM "follows" f WHERE f."followingId" = u."id")
      WHERE u."id" = ANY(${affected.followedIds}::text[])`
  }
  if (affected.followerIds.length) {
    await tx.$executeRaw`
      UPDATE "users" u
      SET "followingCount" = (SELECT COUNT(*)::int FROM "follows" f WHERE f."followerId" = u."id")
      WHERE u."id" = ANY(${affected.followerIds}::text[])`
  }
  if (affected.postIds.length) {
    await tx.$executeRaw`
      UPDATE "posts" p
      SET "likeCount" = (SELECT COUNT(*)::int FROM "post_likes" l WHERE l."postId" = p."id"),
          "commentCount" = (
            SELECT COUNT(*)::int FROM "comments" c
            WHERE c."postId" = p."id" AND c."status" <> 'deleted'
          )
      WHERE p."id" = ANY(${affected.postIds}::text[])`
  }
  if (affected.listingIds.length) {
    await tx.$executeRaw`
      UPDATE "listings" l
      SET "threadCount" = (SELECT COUNT(*)::int FROM "listing_threads" t WHERE t."listingId" = l."id")
      WHERE l."id" = ANY(${affected.listingIds}::text[])`
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
