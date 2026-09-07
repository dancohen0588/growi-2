/**
 * Vocabulaire de la communauté Growi.
 *
 * Mêmes conventions que `enums.ts` : ces valeurs sont celles **stockées en
 * base** (colonnes `String`), donc celles échangées par l'API. Elles sont ici
 * en minuscules et non en MAJUSCULES comme le domaine historique, pour suivre
 * `CARE_LOG_TYPES` et `CONTACT_MESSAGE_STATUSES` — les ajouts récents.
 *
 * La communauté est **opt-in** : tant que `User.communityEnabled` est faux,
 * rien de ce fichier ne concerne le compte.
 */

import { z } from 'zod'

// ─── Pseudo public ─────────────────────────────────────────────────────────

export const HANDLE_MIN_LENGTH = 3
export const HANDLE_MAX_LENGTH = 30

/**
 * Le pseudo est **normalisé en minuscules à l'écriture** : deux comptes ne
 * doivent pas pouvoir s'appeler `Julie` et `julie`, or Postgres tient ces deux
 * chaînes pour distinctes. On normalise plutôt que d'ajouter l'extension
 * `citext` : une colonne déjà normalisée se contente d'un index unique.
 */
export const HANDLE_PATTERN = /^[a-z0-9_]+$/

/**
 * Pseudos que personne ne peut prendre.
 *
 * Deux raisons : ne pas laisser quelqu'un se faire passer pour l'équipe, et
 * garder libres les segments d'URL de la face publique (`/u/…`, `/p/…`).
 */
export const RESERVED_HANDLES = [
  'growi',
  'admin',
  'administrateur',
  'support',
  'contact',
  'equipe',
  'moderation',
  'moderateur',
  'aide',
  'api',
  'www',
  'blog',
  'compte',
  'profil',
  'communaute',
  'bourse',
  'null',
  'undefined',
  'me',
  'moi',
] as const

export const BIO_MAX_LENGTH = 160

// ─── Portée locale ─────────────────────────────────────────────────────────

/**
 * Rayons proposés pour le fil « Autour de moi », en kilomètres.
 *
 * Trois paliers seulement : un curseur continu donnerait l'illusion d'une
 * précision que la position floutée n'a pas.
 */
export const COMMUNITY_RADII_KM = [5, 20, 50] as const
export const communityRadiusSchema = z.union([
  z.literal(5),
  z.literal(20),
  z.literal(50),
])
export type CommunityRadiusKm = z.infer<typeof communityRadiusSchema>

export const DEFAULT_COMMUNITY_RADIUS_KM: CommunityRadiusKm = 20

export const COMMUNITY_RADIUS_LABELS: Record<CommunityRadiusKm, string> = {
  5: '5 km',
  20: '20 km',
  50: '50 km',
}

/**
 * Côté de la grille d'arrondi de la position, en degrés (≈ 1,1 km × 0,7 km à
 * nos latitudes), et amplitude du bruit ajouté ensuite.
 *
 * Voir `lib/services/community/geo.ts` : le bruit est **déterministe par
 * utilisateur**, sans quoi moyenner ses publications redonnerait sa position.
 */
export const FUZZY_GRID_DEGREES = 0.01
export const FUZZY_JITTER_DEGREES = 0.004

// ─── Statut d'un contenu ───────────────────────────────────────────────────

/**
 * `Post.status`, `Comment.status` — et, à partir de la phase 3, la part
 * commune de `Listing.status`.
 *
 * `deleted` est un état, pas un effacement : les compteurs et les fils de
 * commentaires resteraient incohérents si la ligne disparaissait. Les photos,
 * elles, sont bien supprimées du Storage.
 */
export const CONTENT_STATUSES = ['visible', 'hidden', 'deleted'] as const
export const contentStatusSchema = z.enum(CONTENT_STATUSES)
export type ContentStatus = z.infer<typeof contentStatusSchema>

// ─── Signalements ──────────────────────────────────────────────────────────

/** `Report.targetType` — ce qui est signalé. */
export const REPORT_TARGETS = ['post', 'comment', 'listing', 'message', 'user'] as const
export const reportTargetSchema = z.enum(REPORT_TARGETS)
export type ReportTarget = z.infer<typeof reportTargetSchema>

export const REPORT_TARGET_LABELS: Record<ReportTarget, string> = {
  post: 'Publication',
  comment: 'Commentaire',
  listing: 'Annonce',
  message: 'Message',
  user: 'Compte',
}

/** `Report.reason` — motif choisi par celui qui signale. */
export const REPORT_REASONS = ['spam', 'inappropriate', 'scam', 'off_topic', 'other'] as const
export const reportReasonSchema = z.enum(REPORT_REASONS)
export type ReportReason = z.infer<typeof reportReasonSchema>

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  spam: 'Spam ou publicité',
  inappropriate: 'Contenu inapproprié',
  scam: 'Arnaque ou demande d’argent',
  off_topic: 'Hors sujet',
  other: 'Autre',
}

/** `Report.status` — où en est la revue. */
export const REPORT_STATUSES = ['open', 'actioned', 'dismissed'] as const
export const reportStatusSchema = z.enum(REPORT_STATUSES)
export type ReportStatus = z.infer<typeof reportStatusSchema>

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  open: 'À traiter',
  actioned: 'Traité',
  dismissed: 'Rejeté',
}

export const REPORT_NOTE_MAX_LENGTH = 500

/**
 * Nombre de signalements **distincts** au-delà duquel un contenu est masqué
 * sans attendre la revue.
 *
 * Trois personnes différentes, pas trois signalements : l'unicité
 * `(reporterId, targetType, targetId)` en base l'assure. Masquer tôt coûte un
 * contenu légitime le temps d'une vérification ; masquer tard laisse une
 * insulte à l'écran de tout un quartier.
 */
export const AUTO_HIDE_REPORT_THRESHOLD = 3

// ─── Notifications ─────────────────────────────────────────────────────────

/**
 * `Notification.kind`.
 *
 * `like` existe en in-app mais n'est **jamais** poussé : un cœur ne vaut pas
 * qu'un téléphone sonne. Voir `COMMUNITY_PUSH_KINDS`.
 */
export const NOTIFICATION_KINDS = [
  'follow',
  'like',
  'comment',
  'listing_interest',
  'listing_message',
] as const
export const notificationKindSchema = z.enum(NOTIFICATION_KINDS)
export type NotificationKind = z.infer<typeof notificationKindSchema>

/** Les seuls événements communautaires qui peuvent partir en push. */
export const COMMUNITY_PUSH_KINDS = [
  'follow',
  'comment',
  'listing_interest',
  'listing_message',
] as const satisfies readonly NotificationKind[]

/** Une notification lue au-delà de ce délai est purgée par la tournée quotidienne. */
export const NOTIFICATION_RETENTION_DAYS = 90

// ─── Limites de débit (§6.4 de la spec) ────────────────────────────────────

/**
 * Plafonds par utilisateur, comptés en base sur `createdAt` — même approche
 * que le quota du chat, et pour la même raison : un compteur en mémoire est
 * remis à zéro par chaque instance Vercel.
 *
 * Ce sont des garde-fous anti-spam, pas une monétisation : aucun n'est
 * atteignable par un usage normal.
 */
export const COMMUNITY_RATE_LIMITS = {
  /** Publications par jour. */
  postsPerDay: 20,
  /** Commentaires par heure. */
  commentsPerHour: 60,
  /** Annonces simultanément `active`. */
  activeListings: 10,
  /** « Je suis intéressé » par jour. */
  listingInterestsPerDay: 30,
  /** Nouveaux abonnements par jour. */
  followsPerDay: 200,
} as const
