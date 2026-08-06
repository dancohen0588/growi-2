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

export const createGardenSchema = z.object({
  name: z.string().min(1, 'Nom requis').max(50),
  type: gardenTypeSchema,
  description: z.string().max(500).optional(),
  surfaceM2: z.number().positive().optional(),
})

export type CreateGardenInput = z.infer<typeof createGardenSchema>

export const updateGardenSchema = createGardenSchema.partial().extend({
  climateZone: nullish(z.string().max(50)),
  soilType: nullish(z.string().max(100)),
  orientation: nullish(z.string().max(10)),
})

export type UpdateGardenInput = z.infer<typeof updateGardenSchema>
