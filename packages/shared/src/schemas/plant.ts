import { z } from 'zod'

import { plantLocationSchema, sunExposureSchema } from '../constants/enums'
import { idSchema, isoDateTimeSchema, nullish } from './common'

// ─── Catalogue d'espèces ───────────────────────────────────────────────────

/**
 * Fiche du catalogue (`PlantCatalog`).
 *
 * Plusieurs colonnes de listes (mois, types de sol, alias…) sont stockées en
 * base sous forme de chaînes JSON : elles restent typées `string` ici, la
 * désérialisation étant à la charge de l'appelant (`parseJsonArray` côté web).
 */
export const plantCatalogSchema = z.object({
  id: idSchema,
  slug: nullish(z.string()),
  commonName: z.string(),
  scientificName: z.string(),
  family: nullish(z.string()),
  emoji: nullish(z.string()),
  category: z.string(),
  /** Sous-type pour la catégorie TREES_SHRUBS. */
  treeType: nullish(z.string()),
  imageUrl: nullish(z.string()),
  descriptionShort: nullish(z.string()),
  descriptionLong: nullish(z.string()),
  sunExposure: z.string(),
  wateringFreqDays: z.number().int(),
  wateringDifficulty: z.string(),
  minTempCelsius: nullish(z.number()),
  maxTempCelsius: nullish(z.number()),
  hardinesZone: nullish(z.string()),
  soilTypes: nullish(z.string()),
  fertilizerMonths: nullish(z.string()),
  indoor: z.boolean(),
  outdoor: z.boolean(),
  edible: z.boolean(),
  toxic: z.boolean(),
  aliases: nullish(z.string()),
  tags: nullish(z.string()),
  source: nullish(z.string()),

  // Calendrier cultural
  pruningMonths: nullish(z.string()),
  pruningType: nullish(z.string()),
  sowingMonthsIndoor: nullish(z.string()),
  sowingMonthsOutdoor: nullish(z.string()),
  transplantMonths: nullish(z.string()),
  harvestMonthsStart: nullish(z.number().int()),
  harvestMonthsEnd: nullish(z.number().int()),
  harvestDaysFromSowing: nullish(z.number().int()),
  dormancyMonths: nullish(z.string()),
  floweringMonths: nullish(z.string()),

  // Agro-climatologie
  frostSensitivity: nullish(z.string()),
  heatStressThresholdC: nullish(z.number()),
  wateringAdjHeat: nullish(z.number()),
  wateringAdjRain: nullish(z.number()),
  sunHoursNeeded: nullish(z.number()),

  // Entretien spécialisé
  repottingFreqMonths: nullish(z.number().int()),
  repottingSeasons: nullish(z.string()),
  fertilizationType: nullish(z.string()),
  treatmentSeasons: nullish(z.string()),
  mulchRecommended: z.boolean(),
  winterProtectionType: nullish(z.string()),

  // Conseils éditoriaux
  careTipWatering: nullish(z.string()),
  careTipLight: nullish(z.string()),
  careTipSoil: nullish(z.string()),
  careTipPruning: nullish(z.string()),
  careTipDiseases: nullish(z.string()),
  careTipWinter: nullish(z.string()),
  funFact: nullish(z.string()),

  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export type PlantCatalog = z.infer<typeof plantCatalogSchema>

/** Version allégée pour l'autocomplétion et les listes de recherche. */
export const plantCatalogSummarySchema = plantCatalogSchema.pick({
  id: true,
  slug: true,
  commonName: true,
  scientificName: true,
  emoji: true,
  category: true,
  imageUrl: true,
})

export type PlantCatalogSummary = z.infer<typeof plantCatalogSummarySchema>

// ─── Plante de l'utilisateur ───────────────────────────────────────────────

export const plantInstanceSchema = z.object({
  id: idSchema,
  userId: idSchema,
  gardenId: nullish(idSchema),
  zoneId: nullish(idSchema),
  catalogPlantId: nullish(idSchema),
  customName: nullish(z.string()),
  emoji: nullish(z.string()),
  photoUrl: nullish(z.string()),
  location: z.string(),
  positionX: nullish(z.number()),
  positionY: nullish(z.number()),
  datePlanted: nullish(isoDateTimeSchema),
  dateAdded: isoDateTimeSchema,
  wateringFreqDays: nullish(z.number().int()),
  lastWateredAt: nullish(isoDateTimeSchema),
  lastFertilizedAt: nullish(isoDateTimeSchema),
  soilType: nullish(z.string()),
  sunExposure: nullish(z.string()),
  healthStatus: z.string(),
  healthNote: nullish(z.string()),
  notes: nullish(z.string()),

  // Contexte pot / substrat
  containerSizeLiters: nullish(z.number()),
  containerMaterial: nullish(z.string()),
  substrateType: nullish(z.string()),

  // Historique des interventions
  lastPrunedAt: nullish(isoDateTimeSchema),
  lastRepottedAt: nullish(isoDateTimeSchema),
  lastTreatedAt: nullish(isoDateTimeSchema),

  // Données culturales
  seedBatchRef: nullish(z.string()),
  growthStage: nullish(z.string()),
  isMultiYear: nullish(z.boolean()),
  expectedHarvestDate: nullish(isoDateTimeSchema),
  customWateringAdjFactor: nullish(z.number()),
  alertsEnabled: z.boolean(),

  updatedAt: isoDateTimeSchema,
})

export type PlantInstance = z.infer<typeof plantInstanceSchema>

/** Plante accompagnée de sa fiche catalogue et de sa zone (fiche plante mobile). */
export const plantInstanceWithRelationsSchema = plantInstanceSchema.extend({
  catalogPlant: nullish(plantCatalogSchema),
  zone: nullish(
    z.object({
      id: idSchema,
      name: z.string(),
      colorHex: nullish(z.string()),
    }),
  ),
})

export type PlantInstanceWithRelations = z.infer<typeof plantInstanceWithRelationsSchema>

// ─── DTOs ──────────────────────────────────────────────────────────────────

export const createPlantInstanceSchema = z.object({
  catalogPlantId: z.string().optional(),
  customName: z.string().min(1).max(50).optional(),
  emoji: z.string().optional(),
  gardenId: z.string().optional(),
  location: plantLocationSchema,
  wateringFreqDays: z.number().int().positive().optional(),
  sunExposure: sunExposureSchema.optional(),
  datePlanted: z.string().optional(),
  notes: z.string().max(1000).optional(),
})

export type CreatePlantInstanceInput = z.infer<typeof createPlantInstanceSchema>

export const updatePlantInstanceSchema = createPlantInstanceSchema.partial().extend({
  zoneId: nullish(idSchema),
  soilType: nullish(z.string().max(100)),
  photoUrl: nullish(z.string()),
  containerSizeLiters: nullish(z.number().positive()),
  alertsEnabled: z.boolean().optional(),
})

export type UpdatePlantInstanceInput = z.infer<typeof updatePlantInstanceSchema>

/**
 * Ajout d'une plante depuis l'identification photo : si l'espèce reconnue
 * correspond à une entrée du catalogue (via son slug), l'instance est reliée
 * au catalogue ; sinon on crée une plante personnalisée à partir du nom
 * fourni par l'IA.
 */
export const addIdentifiedPlantSchema = z.object({
  commonName: z.string().min(1).max(100),
  scientificName: z.string().max(120).optional(),
  emoji: z.string().max(8).optional(),
  encyclopediaSlug: z.string().max(120).nullable().optional(),
})

export type AddIdentifiedPlantInput = z.infer<typeof addIdentifiedPlantSchema>
