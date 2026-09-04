/**
 * Énumérations métier Growi.
 *
 * Ces valeurs sont celles **stockées en base** (colonnes `String` de Prisma,
 * en MAJUSCULES) et donc celles échangées par l'API. Les libellés français
 * associés sont fournis pour l'affichage ; le web dispose en plus de ses
 * propres tables de correspondance vers ses classes Tailwind
 * (`apps/web/lib/plant-types.ts`), qui restent une affaire de présentation.
 */

import { z } from 'zod'

// ─── Jardin ────────────────────────────────────────────────────────────────

/** `Garden.type` — nature du jardin. */
export const GARDEN_TYPES = ['OUTDOOR', 'INDOOR', 'BALCONY', 'GREENHOUSE', 'ALLOTMENT'] as const
export const gardenTypeSchema = z.enum(GARDEN_TYPES)
export type GardenType = z.infer<typeof gardenTypeSchema>

export const GARDEN_TYPE_LABELS: Record<GardenType, string> = {
  OUTDOOR: 'Jardin extérieur',
  INDOOR: 'Intérieur',
  BALCONY: 'Balcon',
  GREENHOUSE: 'Serre',
  ALLOTMENT: 'Jardin partagé',
}

/**
 * `User.gardenType` — type de jardin déclaré au profil.
 * Attention : distinct de `Garden.type`, valeurs en minuscules et héritées
 * du formulaire de paramètres.
 */
export const PROFILE_GARDEN_TYPES = ['potager', 'ornement', 'mixte', 'interieur', 'balcon'] as const
export const profileGardenTypeSchema = z.enum(PROFILE_GARDEN_TYPES)
export type ProfileGardenType = z.infer<typeof profileGardenTypeSchema>

export const PROFILE_GARDEN_TYPE_LABELS: Record<ProfileGardenType, string> = {
  potager: 'Potager',
  ornement: "Jardin d'ornement",
  mixte: 'Mixte',
  interieur: 'Intérieur',
  balcon: 'Balcon',
}

// ─── Plantes ───────────────────────────────────────────────────────────────

/** `PlantInstance.location` — où vit la plante. */
export const PLANT_LOCATIONS = ['OUTDOOR', 'INDOOR', 'GREENHOUSE', 'BALCONY'] as const
export const plantLocationSchema = z.enum(PLANT_LOCATIONS)
export type PlantLocation = z.infer<typeof plantLocationSchema>

export const PLANT_LOCATION_LABELS: Record<PlantLocation, string> = {
  OUTDOOR: 'Extérieur',
  INDOOR: 'Intérieur',
  GREENHOUSE: 'Serre',
  BALCONY: 'Balcon',
}

/** `PlantCatalog.sunExposure` et `PlantInstance.sunExposure`. */
export const SUN_EXPOSURES = ['FULL_SUN', 'PARTIAL', 'SHADE'] as const
export const sunExposureSchema = z.enum(SUN_EXPOSURES)
export type SunExposure = z.infer<typeof sunExposureSchema>

export const SUN_EXPOSURE_LABELS: Record<SunExposure, string> = {
  FULL_SUN: 'Plein soleil',
  PARTIAL: 'Mi-ombre',
  SHADE: 'Ombre',
}

/** `PlantInstance.healthStatus` et `HealthLog.status`. */
export const HEALTH_STATUSES = ['HEALTHY', 'WARNING', 'CRITICAL'] as const
export const healthStatusSchema = z.enum(HEALTH_STATUSES)
export type HealthStatus = z.infer<typeof healthStatusSchema>

export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
  HEALTHY: 'En bonne santé',
  WARNING: 'À surveiller',
  CRITICAL: 'En danger',
}

/** `PlantCatalog.wateringDifficulty`. */
export const WATERING_DIFFICULTIES = ['EASY', 'MEDIUM', 'DEMANDING'] as const
export const wateringDifficultySchema = z.enum(WATERING_DIFFICULTIES)
export type WateringDifficulty = z.infer<typeof wateringDifficultySchema>

export const WATERING_DIFFICULTY_LABELS: Record<WateringDifficulty, string> = {
  EASY: 'Facile',
  MEDIUM: 'Moyen',
  DEMANDING: 'Exigeant',
}

/** `PlantCatalog.category`. */
export const PLANT_CATEGORIES = [
  'INDOOR',
  'VEGETABLE',
  'FLOWERS',
  'TREES_SHRUBS',
  'HERBS',
  'SUCCULENTS',
  'AQUATIC',
  'CLIMBING',
] as const
export const plantCategorySchema = z.enum(PLANT_CATEGORIES)
export type PlantCategory = z.infer<typeof plantCategorySchema>

export const PLANT_CATEGORY_LABELS: Record<PlantCategory, string> = {
  INDOOR: "Plantes d'intérieur",
  VEGETABLE: 'Potager',
  FLOWERS: 'Fleurs',
  TREES_SHRUBS: 'Arbres et arbustes',
  HERBS: 'Aromatiques',
  SUCCULENTS: 'Succulentes',
  AQUATIC: 'Plantes aquatiques',
  CLIMBING: 'Grimpantes',
}

/** `PlantCatalog.treeType` — sous-type de la catégorie TREES_SHRUBS. */
export const TREE_TYPES = ['CONIFER', 'DECIDUOUS', 'FRUIT', 'SHRUB'] as const
export const treeTypeSchema = z.enum(TREE_TYPES)
export type TreeType = z.infer<typeof treeTypeSchema>

export const TREE_TYPE_LABELS: Record<TreeType, string> = {
  CONIFER: 'Conifère',
  DECIDUOUS: 'Feuillu',
  FRUIT: 'Fruitier',
  SHRUB: 'Arbuste',
}

// ─── Journal d'entretien ───────────────────────────────────────────────────

/**
 * Gestes d'entretien enregistrables.
 *
 * Les quatre premiers alimentent le moteur de conseils via les dates portées
 * par `PlantInstance` ; les suivants complètent le vocabulaire que ce moteur
 * savait déjà produire (récolte, traitement, rempotage, semis) sans qu'on
 * puisse les noter.
 */
export const CARE_LOG_TYPES = [
  'watering',
  'pruning',
  'fertilizing',
  'health',
  'harvest',
  'treatment',
  'repotting',
  'sowing',
  'other',
] as const
export const careLogTypeSchema = z.enum(CARE_LOG_TYPES)
export type CareLogType = z.infer<typeof careLogTypeSchema>

export const CARE_LOG_TYPE_LABELS: Record<CareLogType, string> = {
  watering: 'Arrosage',
  pruning: 'Taille',
  fertilizing: 'Fertilisation',
  health: 'Santé',
  harvest: 'Récolte',
  treatment: 'Traitement',
  repotting: 'Rempotage',
  sowing: 'Semis',
  other: 'Autre geste',
}

/** Verbe à la première personne, pour les boutons d'action. */
export const CARE_LOG_ACTION_LABELS: Record<CareLogType, string> = {
  watering: "J'ai arrosé",
  pruning: "J'ai taillé",
  fertilizing: "J'ai fertilisé",
  health: 'Note de santé',
  harvest: "J'ai récolté",
  treatment: "J'ai traité",
  repotting: "J'ai rempoté",
  sowing: "J'ai semé",
  other: 'Autre geste',
}

/**
 * Icône de chaque geste, par son nom.
 *
 * Comme pour la météo, seul le **nom** est partagé : le web le relie à un
 * composant `lucide-react`, le mobile à `lucide-react-native`. C'est ce qui
 * garantit qu'une récolte porte le même signe sur les deux plateformes.
 */
export const CARE_LOG_ICONS: Record<CareLogType, string> = {
  watering: 'droplets',
  pruning: 'scissors',
  fertilizing: 'recycle',
  health: 'heart-pulse',
  harvest: 'shopping-basket',
  treatment: 'spray-can',
  repotting: 'shovel',
  sowing: 'sprout',
  other: 'leaf',
}

export type CareIconName = (typeof CARE_LOG_ICONS)[CareLogType]

// ─── Comptes et administration ─────────────────────────────────────────────

/**
 * `User.role` — droits du compte.
 *
 * Volontairement une chaîne et non un enum Postgres, comme le reste du schéma :
 * ajouter un rôle intermédiaire (SUPPORT, EDITOR) ne demandera pas de migration.
 * Ces valeurs ne sont **pas** exposées par l'API v1 : le rôle ne vit que dans
 * la session NextAuth du web, seule surface où l'administration existe.
 */
export const USER_ROLES = ['USER', 'ADMIN'] as const
export const userRoleSchema = z.enum(USER_ROLES)
export type UserRole = z.infer<typeof userRoleSchema>

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  USER: 'Utilisateur',
  ADMIN: 'Administrateur',
}

/** Valeur par défaut de `User.role` en base. */
export const DEFAULT_USER_ROLE: UserRole = 'USER'

/**
 * `UserActivity.surface` — d'où vient la requête authentifiée.
 *
 * Déduit du mécanisme d'authentification, pas d'un en-tête déclaré par le
 * client : un Bearer, c'est le mobile ; un cookie de session, c'est le web.
 */
export const ACTIVITY_SURFACES = ['web', 'mobile'] as const
export const activitySurfaceSchema = z.enum(ACTIVITY_SURFACES)
export type ActivitySurface = z.infer<typeof activitySurfaceSchema>

export const ACTIVITY_SURFACE_LABELS: Record<ActivitySurface, string> = {
  web: 'Site web',
  mobile: 'Application mobile',
}

// ─── Messagerie de contact ─────────────────────────────────────────────────

/**
 * `ContactMessage.status` — où en est le message.
 *
 * Un message archivé peut être rouvert : « archivé » range, il ne clôt pas.
 */
export const CONTACT_MESSAGE_STATUSES = ['new', 'answered', 'archived'] as const
export const contactMessageStatusSchema = z.enum(CONTACT_MESSAGE_STATUSES)
export type ContactMessageStatus = z.infer<typeof contactMessageStatusSchema>

export const CONTACT_MESSAGE_STATUS_LABELS: Record<ContactMessageStatus, string> = {
  new: 'Nouveau',
  answered: 'Répondu',
  archived: 'Archivé',
}

/**
 * `ContactMessage.source` — d'où vient le message.
 *
 * `beta_ios` est une inscription à la liste d'attente, pas un vrai message :
 * elle n'a ni nom ni sujet. `admin_outbound` est un envoi parti de l'admin,
 * conservé pour garder trace de ce qu'on a écrit à quelqu'un.
 */
export const CONTACT_MESSAGE_SOURCES = ['contact', 'beta_ios', 'admin_outbound'] as const
export const contactMessageSourceSchema = z.enum(CONTACT_MESSAGE_SOURCES)
export type ContactMessageSource = z.infer<typeof contactMessageSourceSchema>

export const CONTACT_MESSAGE_SOURCE_LABELS: Record<ContactMessageSource, string> = {
  contact: 'Formulaire de contact',
  beta_ios: 'Bêta iOS',
  admin_outbound: "Envoi depuis l'admin",
}

// ─── Notifications ─────────────────────────────────────────────────────────

export const NOTIFICATION_CHANNELS = ['push', 'email', 'both', 'none'] as const
export const notificationChannelSchema = z.enum(NOTIFICATION_CHANNELS)
export type NotificationChannel = z.infer<typeof notificationChannelSchema>

export const ALERT_FREQUENCIES = ['immediate', 'daily_digest', 'weekly_digest'] as const
export const alertFrequencySchema = z.enum(ALERT_FREQUENCIES)
export type AlertFrequency = z.infer<typeof alertFrequencySchema>

// ─── Divers ────────────────────────────────────────────────────────────────

/** Valeur par défaut de `User.plan` en base. */
export const DEFAULT_USER_PLAN = 'FREE'

/** Valeur par défaut de `User.timezone` en base. */
export const DEFAULT_TIMEZONE = 'Europe/Paris'
