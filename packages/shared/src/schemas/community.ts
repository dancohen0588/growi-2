import { z } from 'zod'

import {
  BIO_MAX_LENGTH,
  COMMENT_BODY_MAX_LENGTH,
  communityRadiusSchema,
  HANDLE_MAX_LENGTH,
  HANDLE_MIN_LENGTH,
  HANDLE_PATTERN,
  LISTING_AUTHOR_STATUSES,
  LISTING_DESCRIPTION_MAX_LENGTH,
  LISTING_MESSAGE_MAX_LENGTH,
  LISTING_QUANTITY_MAX_LENGTH,
  LISTING_TITLE_MAX_LENGTH,
  LISTING_WANTS_MAX_LENGTH,
  listingCategorySchema,
  listingKindSchema,
  listingStatusSchema,
  notificationKindSchema,
  POST_BODY_MAX_LENGTH,
  POST_MAX_PHOTOS,
  POST_MIN_PHOTOS,
  REPORT_NOTE_MAX_LENGTH,
  reportReasonSchema,
  reportTargetSchema,
  RESERVED_HANDLES,
} from '../constants/community'
import { cursorPageSchema, idSchema, isoDateTimeSchema, nullish } from './common'

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

// ─── Publications ──────────────────────────────────────────────────────────

/**
 * Une publication telle qu'elle apparaît dans le fil.
 *
 * Ni `lat`, ni `lng`, ni même la position floutée : la proximité ne sort que
 * sous la forme déjà mise en forme de `author.distanceLabel`.
 */
export const communityPostSchema = z.object({
  id: idSchema,
  author: communityUserSchema,
  body: z.string(),
  /** 1 à 4 URLs Supabase Storage. */
  photos: z.array(z.string()),
  /**
   * Nom de la plante, **figé à la publication**. La plante peut être renommée
   * ou supprimée ; la publication, elle, ne doit pas changer de sens.
   */
  plantLabel: nullish(z.string()),
  /** `null` dès que la plante a été supprimée — la pastille cesse d'être tactile. */
  plantInstanceId: nullish(z.string()),
  likeCount: z.number().int(),
  commentCount: z.number().int(),
  /** `null` pour une lecture anonyme : personne n'est là pour aimer. */
  likedByMe: z.boolean().nullable(),
  /** Vrai sur ses propres publications : l'UI y montre « Supprimer ». */
  isMine: z.boolean(),
  createdAt: isoDateTimeSchema,
})

export type CommunityPost = z.infer<typeof communityPostSchema>

/**
 * Corps de `POST /api/v1/community/posts`.
 *
 * Les photos sont déposées avant, par `/api/v1/uploads` (kind `post`) : on ne
 * reçoit ici que leurs URLs. Séparer les deux gestes fait qu'une photo
 * abandonnée ne casse rien, et qu'une publication ne se perd pas parce qu'une
 * image sur quatre a échoué.
 */
export const createPostSchema = z.object({
  body: z.string().trim().max(POST_BODY_MAX_LENGTH),
  photos: z.array(z.string().min(1)).min(POST_MIN_PHOTOS).max(POST_MAX_PHOTOS),
  /** Plante mise en avant, facultative. */
  plantInstanceId: nullish(idSchema),
})

export type CreatePostInput = z.infer<typeof createPostSchema>

/**
 * Corps de `PATCH …/posts/[id]` — le texte, et rien d'autre.
 *
 * Les photos ne se remplacent pas : un cœur déjà donné ne voudrait plus rien
 * dire si l'image sous laquelle il a été donné pouvait changer.
 */
export const updatePostSchema = z.object({
  body: z.string().trim().max(POST_BODY_MAX_LENGTH),
})

export type UpdatePostInput = z.infer<typeof updatePostSchema>

export const communityCommentSchema = z.object({
  id: idSchema,
  author: communityUserSchema,
  body: z.string(),
  /** Vrai pour l'auteur du commentaire **et** pour celui de la publication. */
  canDelete: z.boolean(),
  createdAt: isoDateTimeSchema,
})

export type CommunityComment = z.infer<typeof communityCommentSchema>

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(COMMENT_BODY_MAX_LENGTH),
})

export type CreateCommentInput = z.infer<typeof createCommentSchema>

export const communityCommentPageSchema = cursorPageSchema(communityCommentSchema)
export type CommunityCommentPage = z.infer<typeof communityCommentPageSchema>

/** Détail d'une publication — écran 2, avec ses premiers commentaires. */
export const communityPostDetailSchema = communityPostSchema.extend({
  comments: communityCommentPageSchema,
})

export type CommunityPostDetail = z.infer<typeof communityPostDetailSchema>

/** Réponse de `POST`/`DELETE …/like`. */
export const likeResultSchema = z.object({
  liked: z.boolean(),
  likeCount: z.number().int(),
})

export type LikeResult = z.infer<typeof likeResultSchema>

/**
 * Les deux fils.
 *
 * `nearby` est local et dépend d'où l'on est ; `following` ne dépend que de
 * qui l'on suit, sans aucune contrainte de distance — suivre quelqu'un, c'est
 * précisément dire qu'on veut le voir même s'il déménage.
 */
export const FEED_SCOPES = ['nearby', 'following'] as const
export const feedScopeSchema = z.enum(FEED_SCOPES)
export type FeedScope = z.infer<typeof feedScopeSchema>

/**
 * Une page de fil.
 *
 * Sur `nearby`, `appliedRadiusKm` peut dépasser le rayon demandé : quand le
 * voisinage immédiat est vide, le fil élargit de lui-même. L'écran doit le
 * dire — afficher des publications à 50 km sans prévenir laisserait croire
 * qu'un inconnu habite la rue d'à côté.
 *
 * Sur `following`, les trois champs de rayon valent `null` : la distance n'y
 * joue aucun rôle.
 */
export const communityFeedSchema = cursorPageSchema(communityPostSchema).extend({
  scope: feedScopeSchema,
  requestedRadiusKm: communityRadiusSchema.nullable(),
  appliedRadiusKm: z.number().int().nullable(),
  widened: z.boolean(),
})

export type CommunityFeed = z.infer<typeof communityFeedSchema>

/** Une page de profils — abonnés, abonnements. */
export const communityUserPageSchema = cursorPageSchema(communityUserSchema)
export type CommunityUserPage = z.infer<typeof communityUserPageSchema>

/** Une page de publications d'un compte, pour son profil public. */
export const communityPostPageSchema = cursorPageSchema(communityPostSchema)
export type CommunityPostPage = z.infer<typeof communityPostPageSchema>

/**
 * Ce que l'Accueil affiche de la communauté.
 *
 * Servi par une route **séparée** de `/api/v1/summary`, et chargé après elle :
 * l'accueil est l'écran le plus consulté de l'app, et la communauté ne doit
 * pas pouvoir en retarder l'affichage.
 */
export const communityHomeSchema = z.object({
  /** Faux tant que le profil public n'est pas activé : l'accueil n'affiche alors rien. */
  enabled: z.boolean(),
  /** Les deux ou trois dernières publications proches. */
  posts: z.array(communityPostSchema),
})

export type CommunityHome = z.infer<typeof communityHomeSchema>

// ─── Bourse aux graines ────────────────────────────────────────────────────

/**
 * Une annonce, telle qu'affichée dans la bourse et sur son détail.
 *
 * Comme les publications : ni `lat`, ni `lng`, seulement la distance déjà mise
 * en forme sur `author`.
 */
export const listingSchema = z.object({
  id: idSchema,
  author: communityUserSchema,
  kind: listingKindSchema,
  category: listingCategorySchema,
  title: z.string(),
  description: nullish(z.string()),
  photoUrl: nullish(z.string()),
  /** Espèce du catalogue, si l'auteur l'a identifiée. */
  catalogPlantId: nullish(z.string()),
  /** Texte libre : « ~30 graines », « 3 plants ». */
  quantity: nullish(z.string()),
  /** Ce que l'auteur souhaite en retour, sur une annonce d'échange. */
  wants: nullish(z.string()),
  status: listingStatusSchema,
  /** Nombre d'intéressés — visible de l'auteur seul, `null` pour les autres. */
  threadCount: z.number().int().nullable(),
  expiresAt: isoDateTimeSchema,
  isMine: z.boolean(),
  /**
   * Le fil que **ce lecteur** a déjà ouvert sur cette annonce, s'il y en a un :
   * le CTA devient « Reprendre la discussion » au lieu d'en rouvrir un.
   */
  myThreadId: nullish(z.string()),
  createdAt: isoDateTimeSchema,
})

export type Listing = z.infer<typeof listingSchema>

export const listingPageSchema = cursorPageSchema(listingSchema)
export type ListingPage = z.infer<typeof listingPageSchema>

/** Corps de `POST /api/v1/community/listings`. */
export const createListingSchema = z.object({
  kind: listingKindSchema,
  category: listingCategorySchema,
  title: z.string().trim().min(1).max(LISTING_TITLE_MAX_LENGTH),
  description: nullish(z.string().trim().max(LISTING_DESCRIPTION_MAX_LENGTH)),
  /** Déposée par `/api/v1/uploads` (kind `listing`) avant cet appel. */
  photoUrl: nullish(z.string()),
  catalogPlantId: nullish(idSchema),
  quantity: nullish(z.string().trim().max(LISTING_QUANTITY_MAX_LENGTH)),
  wants: nullish(z.string().trim().max(LISTING_WANTS_MAX_LENGTH)),
})

export type CreateListingInput = z.infer<typeof createListingSchema>

/**
 * Corps de `PATCH …/listings/[id]`.
 *
 * `status` n'accepte que les trois valeurs que l'auteur peut poser :
 * `expired` est l'affaire de la tournée quotidienne, `hidden` celle de la
 * modération, et `deleted` passe par `DELETE`.
 */
export const updateListingSchema = z.object({
  title: z.string().trim().min(1).max(LISTING_TITLE_MAX_LENGTH).optional(),
  description: nullish(z.string().trim().max(LISTING_DESCRIPTION_MAX_LENGTH)),
  quantity: nullish(z.string().trim().max(LISTING_QUANTITY_MAX_LENGTH)),
  wants: nullish(z.string().trim().max(LISTING_WANTS_MAX_LENGTH)),
  status: z.enum(LISTING_AUTHOR_STATUSES).optional(),
  /** `true` repart pour 60 jours à compter de maintenant. */
  extend: z.boolean().optional(),
})

export type UpdateListingInput = z.infer<typeof updateListingSchema>

/** Filtres de la bourse, lus depuis l'URL. */
export const listingFiltersSchema = z.object({
  kind: listingKindSchema.optional(),
  category: listingCategorySchema.optional(),
  radiusKm: communityRadiusSchema.optional(),
})

export type ListingFilters = z.infer<typeof listingFiltersSchema>

// ─── Fils de discussion ────────────────────────────────────────────────────

export const listingMessageSchema = z.object({
  id: idSchema,
  threadId: idSchema,
  /** Vrai si c'est moi qui l'ai écrit — la bulle change de côté. */
  isMine: z.boolean(),
  body: z.string(),
  photoUrl: nullish(z.string()),
  createdAt: isoDateTimeSchema,
})

export type ListingMessage = z.infer<typeof listingMessageSchema>

export const listingMessagePageSchema = cursorPageSchema(listingMessageSchema)
export type ListingMessagePage = z.infer<typeof listingMessagePageSchema>

/**
 * Un fil, tel qu'il apparaît dans « Messages ».
 *
 * `listing` y est réduit à ce qu'il faut pour la vignette : le fil reste
 * lisible même si l'annonce a été retirée depuis.
 */
export const listingThreadSchema = z.object({
  id: idSchema,
  listingId: idSchema,
  listingTitle: z.string(),
  listingPhotoUrl: nullish(z.string()),
  listingStatus: listingStatusSchema,
  /** L'autre personne — l'auteur si je suis l'intéressé, et l'inverse. */
  other: communityUserSchema,
  /** Suis-je l'auteur de l'annonce ? */
  isOwner: z.boolean(),
  lastMessage: nullish(z.string()),
  lastMessageAt: nullish(isoDateTimeSchema),
  /** Vrai s'il s'est dit quelque chose depuis ma dernière lecture. */
  unread: z.boolean(),
  createdAt: isoDateTimeSchema,
})

export type ListingThread = z.infer<typeof listingThreadSchema>

export const listingThreadPageSchema = cursorPageSchema(listingThreadSchema)
export type ListingThreadPage = z.infer<typeof listingThreadPageSchema>

/** Le fil et sa première page de messages — écran 6. */
export const listingThreadDetailSchema = listingThreadSchema.extend({
  messages: listingMessagePageSchema,
})

export type ListingThreadDetail = z.infer<typeof listingThreadDetailSchema>

export const sendListingMessageSchema = z.object({
  body: z.string().trim().min(1).max(LISTING_MESSAGE_MAX_LENGTH),
  photoUrl: nullish(z.string()),
})

export type SendListingMessageInput = z.infer<typeof sendListingMessageSchema>

// ─── Notifications ─────────────────────────────────────────────────────────

/**
 * Où mène le tap sur une notification.
 *
 * Un objet à champs facultatifs plutôt qu'une union discriminée : la colonne
 * est en Json et porte déjà des notifications écrites par des versions
 * antérieures de l'app. Le routeur de l'app lit ce qui est présent et ne fait
 * rien de ce qu'il ne reconnaît pas, ce qui laisse ajouter une cible sans
 * casser les installations déjà déployées.
 */
export const notificationTargetSchema = z.object({
  postId: nullish(z.string()),
  /** Fil de discussion d'une annonce. */
  threadId: nullish(z.string()),
  listingId: nullish(z.string()),
  /** Pseudo de l'acteur, pour ouvrir son profil. */
  handle: nullish(z.string()),
})

export type NotificationTarget = z.infer<typeof notificationTargetSchema>

export const communityNotificationSchema = z.object({
  id: idSchema,
  kind: notificationKindSchema,
  /** `null` quand l'acteur a supprimé son compte — la notification reste lisible. */
  actor: communityUserSchema.nullable(),
  /**
   * Texte figé à l'écriture. L'acteur peut changer de pseudo et le contenu
   * être supprimé : ce qui a été annoncé ne doit pas se réécrire tout seul.
   */
  preview: z.string(),
  target: notificationTargetSchema,
  readAt: nullish(isoDateTimeSchema),
  createdAt: isoDateTimeSchema,
})

export type CommunityNotification = z.infer<typeof communityNotificationSchema>

export const communityNotificationPageSchema = cursorPageSchema(communityNotificationSchema)
export type CommunityNotificationPage = z.infer<typeof communityNotificationPageSchema>

/** Le badge de la cloche. */
export const unreadCountSchema = z.object({
  unread: z.number().int(),
})

export type UnreadCount = z.infer<typeof unreadCountSchema>

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
