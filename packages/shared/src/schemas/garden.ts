import { z } from 'zod'

import { gardenTypeSchema } from '../constants/enums'
import { idSchema, isoDateTimeSchema, nullish } from './common'

// ─── Zone de jardin ────────────────────────────────────────────────────────

export const gardenZoneSchema = z.object({
  id: idSchema,
  gardenId: idSchema,
  name: z.string(),
  /** Libre : les zones sont définies par l'utilisateur (pelouse, massif, potager…). */
  type: z.string(),
  colorHex: nullish(z.string()),
})

export type GardenZone = z.infer<typeof gardenZoneSchema>

export const createGardenZoneSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(50),
  type: z.string().min(1).max(50),
  colorHex: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur hexadécimale attendue (#RRGGBB)')
    .optional(),
})

export type CreateGardenZoneInput = z.infer<typeof createGardenZoneSchema>

export const updateGardenZoneSchema = createGardenZoneSchema.partial()
export type UpdateGardenZoneInput = z.infer<typeof updateGardenZoneSchema>

// ─── Jardin ────────────────────────────────────────────────────────────────

export const gardenSchema = z.object({
  id: idSchema,
  userId: idSchema,
  name: z.string(),
  description: nullish(z.string()),
  type: z.string(),
  surfaceM2: nullish(z.number()),
  climateZone: nullish(z.string()),
  soilType: nullish(z.string()),
  orientation: nullish(z.string()),
  /** Plan du jardin sérialisé (canvas Konva) — édité uniquement côté web. */
  canvasData: nullish(z.string()),
  createdAt: isoDateTimeSchema,
  updatedAt: isoDateTimeSchema,
})

export type Garden = z.infer<typeof gardenSchema>

/** Jardin enrichi pour les listes : zones et nombre de plantes. */
export const gardenWithStatsSchema = gardenSchema.extend({
  zones: z.array(gardenZoneSchema).optional(),
  plantCount: z.number().int().nonnegative().optional(),
})

export type GardenWithStats = z.infer<typeof gardenWithStatsSchema>

// ─── Plan du jardin ────────────────────────────────────────────────────────

/**
 * Le plan dessiné, rendu en SVG par le serveur.
 *
 * L'app le reçoit prêt à afficher plutôt que sous forme de `canvasData` brut :
 * le moteur de dessin vit côté web, et le dupliquer garantirait qu'un jour les
 * deux plans ne se ressemblent plus.
 */
export const gardenPlanSchema = z.object({
  /** Document SVG autonome. */
  svg: z.string(),
  /** Dimensions du `viewBox`, pour dimensionner le conteneur. */
  width: z.number().positive(),
  height: z.number().positive(),
  elementCount: z.number().int().nonnegative(),
})

export type GardenPlan = z.infer<typeof gardenPlanSchema>

export const createGardenSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(50),
  type: gardenTypeSchema,
  description: z.string().max(500).optional(),
  surfaceM2: z.number().positive().optional(),
})

export type CreateGardenInput = z.infer<typeof createGardenSchema>

export const updateGardenSchema = createGardenSchema.partial().extend({
  // `null` efface le champ ; `undefined` le laisse inchangé.
  description: nullish(z.string().max(500)),
  climateZone: nullish(z.string().max(50)),
  soilType: nullish(z.string().max(100)),
  orientation: nullish(z.string().max(10)),
})

export type UpdateGardenInput = z.infer<typeof updateGardenSchema>
