import { z } from 'zod'

import {
  BIO_MAX_LENGTH,
  communityRadiusSchema,
  HANDLE_MAX_LENGTH,
  HANDLE_MIN_LENGTH,
  HANDLE_PATTERN,
  REPORT_NOTE_MAX_LENGTH,
  reportReasonSchema,
  reportTargetSchema,
  RESERVED_HANDLES,
} from '../constants/community'
import { idSchema, isoDateTimeSchema, nullish } from './common'

/**
 * Communauté Growi — contrats de la phase 0 : identité publique, graphe
 * social, signalement.
 *
 * Deux principes tiennent tout le reste :
 *
 * 1. **L'identité publique est disjointe de l'identité du compte.** Le fil
 *    n'affiche que `handle`, un avatar et une ville. `email`, `name`,
 *    `firstName`, `address`, `latitude` ne sortent jamais — d'où un schéma
 *    séparé, `communityUserSchema`, et non une projection de `publicUserSchema`
 *    (qui, malgré son nom, décrit le compte privé de son propre porteur).
 * 2. **La position est floutée à la source.** Aucune coordonnée ne figure dans
 *    une réponse : seule une distance déjà arrondie en français.
 */

// ─── Identité publique ─────────────────────────────────────────────────────

/**
 * Pseudo saisi par l'utilisateur.
 *
 * Normalisé en minuscules **avant** validation : refuser `Julie` au motif
 * d'une majuscule serait incompréhensible alors qu'on sait quoi en faire.
 */
export const handleSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(HANDLE_MIN_LENGTH, `Au moins ${HANDLE_MIN_LENGTH} caractères`)
  .max(HANDLE_MAX_LENGTH, `Au plus ${HANDLE_MAX_LENGTH} caractères`)
  .regex(HANDLE_PATTERN, 'Lettres sans accent, chiffres et « _ » seulement')
  .refine((value) => !(RESERVED_HANDLES as readonly string[]).includes(value), {
    message: 'Ce pseudo est réservé',
  })

export const bioSchema = z.string().trim().max(BIO_MAX_LENGTH)

/**
 * Un compte tel qu'il apparaît partout dans la communauté — carte de
 * publication, liste d'abonnés, auteur d'une annonce.
 *
 * C'est la **barrière** : toute réponse qui mentionne quelqu'un passe par
 * `toCommunityUser()`, qui construit cet objet champ par champ. Une colonne
 * ajoutée demain à `User` ne peut donc pas apparaître à l'écran toute seule.
 */
export const communityUserSchema = z.object({
  id: idSchema,
  handle: z.string(),
  /** URL de photo, ou `null` : l'UI retombe alors sur `avatarColor` + initiale. */
  avatarUrl: nullish(z.string()),
  /** Couleur de repli, telle que déjà utilisée dans l'app. */
  avatarColor: nullish(z.string()),
  /** Ville déclarée (`locationCity`) — jamais l'adresse. */
  city: nullish(z.string()),
  /**
   * Distance déjà mise en forme (« à moins d'1 km », « à ~3 km »).
   * Absente pour une lecture anonyme, et sur son propre profil.
   */
  distanceLabel: nullish(z.string()),
})

export type CommunityUser = z.infer<typeof communityUserSchema>

/** Profil public complet — écran 3. */
export const communityProfileSchema = communityUserSchema.extend({
  bio: nullish(z.string()),
  followerCount: z.number().int(),
  followingCount: z.number().int(),
  postCount: z.number().int(),
  /** Vrai sur son propre profil : l'UI montre « Modifier » au lieu de « Suivre ». */
  isSelf: z.boolean(),
  /** `null` pour une lecture anonyme — il n'y a personne pour suivre. */
  isFollowing: z.boolean().nullable(),
  /** Ce compte que j'ai bloqué. Son contenu ne m'est plus servi. */
  isBlocked: z.boolean().nullable(),
  memberSince: isoDateTimeSchema,
})

export type CommunityProfile = z.infer<typeof communityProfileSchema>

// ─── Mes réglages (GET/PATCH /api/v1/community/me) ─────────────────────────

/**
 * L'état de ma propre participation.
 *
 * `enabled` faux et `handle` nul est l'état de départ de **tous** les comptes,
 * y compris ceux créés avant la communauté : l'opt-in est explicite.
 */
export const communitySettingsSchema = z.object({
  enabled: z.boolean(),
  enabledAt: nullish(isoDateTimeSchema),
  handle: nullish(z.string()),
  bio: nullish(z.string()),
  radiusKm: communityRadiusSchema,
  followerCount: z.number().int(),
  followingCount: z.number().int(),
  postCount: z.number().int(),
  /**
   * L'activation exige une position : sans elle, ni fil local ni distance.
   * Faux ⇒ l'écran d'activation demande d'abord la ville.
   */
  hasLocation: z.boolean(),
  city: nullish(z.string()),
})

export type CommunitySettings = z.infer<typeof communitySettingsSchema>

/**
 * Corps de `PATCH /api/v1/community/me`.
 *
 * Le même appel active le profil et le modifie : un écran d'activation qui
 * poste un pseudo et `enabled: true` n'a pas de raison d'être une route à
 * part. Rien n'y est obligatoire, ce qui permet aussi de ne changer que le
 * rayon depuis les réglages.
 */
export const updateCommunitySettingsSchema = z.object({
  enabled: z.boolean().optional(),
  handle: handleSchema.optional(),
  bio: nullish(bioSchema),
  radiusKm: communityRadiusSchema.optional(),
})

export type UpdateCommunitySettingsInput = z.infer<typeof updateCommunitySettingsSchema>

/** Réponse de `GET /api/v1/community/handles/check?handle=`. */
export const handleAvailabilitySchema = z.object({
  handle: z.string(),
  available: z.boolean(),
  /** Motif du refus, prêt à afficher sous le champ. `null` si disponible. */
  reason: z.string().nullable(),
})

export type HandleAvailability = z.infer<typeof handleAvailabilitySchema>

// ─── Abonnements et blocage ────────────────────────────────────────────────

/** Réponse de `POST`/`DELETE …/follow` — l'UI y relit son compteur. */
export const followResultSchema = z.object({
  isFollowing: z.boolean(),
  followerCount: z.number().int(),
})

export type FollowResult = z.infer<typeof followResultSchema>

/**
 * Réponse de `POST`/`DELETE …/block`.
 *
 * Bloquer **rompt les abonnements dans les deux sens** : rester abonné à
 * quelqu'un qu'on ne voit plus n'a pas de sens, et le débloquer ne les rétablit
 * pas. L'écran de confirmation le dit.
 */
export const blockResultSchema = z.object({
  isBlocked: z.boolean(),
})

export type BlockResult = z.infer<typeof blockResultSchema>

/** Une ligne de « Comptes bloqués », dans les réglages. */
export const blockedAccountSchema = z.object({
  user: communityUserSchema,
  blockedAt: isoDateTimeSchema,
})

export type BlockedAccount = z.infer<typeof blockedAccountSchema>

// ─── Signalement ───────────────────────────────────────────────────────────

/**
 * Corps de `POST /api/v1/community/reports`.
 *
 * Un signalement par contenu et par personne : le contrainte d'unicité en base
 * l'assure, et la route est **idempotente** plutôt qu'en erreur — signaler deux
 * fois est un geste d'insistance, pas une faute à afficher.
 */
export const createReportSchema = z.object({
  targetType: reportTargetSchema,
  targetId: idSchema,
  reason: reportReasonSchema,
  note: z.string().trim().max(REPORT_NOTE_MAX_LENGTH).optional(),
})

export type CreateReportInput = z.infer<typeof createReportSchema>

/**
 * Ce que l'auteur du signalement voit en retour.
 *
 * Volontairement pauvre : lui dire combien de fois un contenu a été signalé,
 * ou s'il vient d'être masqué, ferait du compteur un instrument de mesure pour
 * qui voudrait s'en servir contre quelqu'un.
 */
export const reportReceiptSchema = z.object({
  reported: z.boolean(),
})

export type ReportReceipt = z.infer<typeof reportReceiptSchema>
