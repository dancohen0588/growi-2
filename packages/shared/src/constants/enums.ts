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

/** Discriminant du endpoint unifié `POST /api/v1/plants/[id]/logs`. */
export const CARE_LOG_TYPES = ['watering', 'pruning', 'fertilizing', 'health'] as const
export const careLogTypeSchema = z.enum(CARE_LOG_TYPES)
export type CareLogType = z.infer<typeof careLogTypeSchema>

export const CARE_LOG_TYPE_LABELS: Record<CareLogType, string> = {
  watering: 'Arrosage',
  pruning: 'Taille',
  fertilizing: 'Fertilisation',
  health: 'Santé',
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
