import { z } from 'zod'

import { healthStatusSchema } from '../constants/enums'
import { idSchema, isoDateTimeSchema, nullish } from './common'

// ─── Entités ───────────────────────────────────────────────────────────────

export const wateringLogSchema = z.object({
  id: idSchema,
  plantInstanceId: idSchema,
  wateredAt: isoDateTimeSchema,
  note: nullish(z.string()),
})

export type WateringLog = z.infer<typeof wateringLogSchema>

export const healthLogSchema = z.object({
  id: idSchema,
  plantInstanceId: idSchema,
  status: z.string(),
  note: nullish(z.string()),
  photoUrl: nullish(z.string()),
  loggedAt: isoDateTimeSchema,
})

export type HealthLog = z.infer<typeof healthLogSchema>

export const pruningLogSchema = z.object({
  id: idSchema,
  plantInstanceId: idSchema,
  prunedAt: isoDateTimeSchema,
  pruningType: nullish(z.string()),
  note: nullish(z.string()),
})

export type PruningLog = z.infer<typeof pruningLogSchema>

export const fertilizingLogSchema = z.object({
  id: idSchema,
  plantInstanceId: idSchema,
  fertilizedAt: isoDateTimeSchema,
  productUsed: nullish(z.string()),
  note: nullish(z.string()),
})

export type FertilizingLog = z.infer<typeof fertilizingLogSchema>

/** Historique complet d'une plante, groupé par type d'intervention. */
export const careLogsSchema = z.object({
  watering: z.array(wateringLogSchema),
  pruning: z.array(pruningLogSchema),
  fertilizing: z.array(fertilizingLogSchema),
  health: z.array(healthLogSchema),
})

export type CareLogs = z.infer<typeof careLogsSchema>

// ─── DTOs de création ──────────────────────────────────────────────────────

const noteField = z.string().max(500).optional()

export const createWateringLogSchema = z.object({
  type: z.literal('watering'),
  wateredAt: z.iso.datetime().optional(),
  note: noteField,
})

export const createPruningLogSchema = z.object({
  type: z.literal('pruning'),
  prunedAt: z.iso.datetime().optional(),
  pruningType: z.string().max(50).optional(),
  note: noteField,
})

export const createFertilizingLogSchema = z.object({
  type: z.literal('fertilizing'),
  fertilizedAt: z.iso.datetime().optional(),
  productUsed: z.string().max(100).optional(),
  note: noteField,
})

export const createHealthLogSchema = z.object({
  type: z.literal('health'),
  status: healthStatusSchema,
  loggedAt: z.iso.datetime().optional(),
  photoUrl: z.string().max(2000).optional(),
  note: noteField,
})

/**
 * Corps de `POST /api/v1/plants/[id]/logs` : union discriminée par `type`,
 * pour n'exposer qu'un seul endpoint d'écriture au mobile.
 */
export const createCareLogSchema = z.discriminatedUnion('type', [
  createWateringLogSchema,
  createPruningLogSchema,
  createFertilizingLogSchema,
  createHealthLogSchema,
])

export type CreateCareLogInput = z.infer<typeof createCareLogSchema>

/** Réponse de `POST /api/v1/plants/[id]/logs` : le log créé et son type. */
export type CreatedCareLog =
  | { type: 'watering'; log: WateringLog }
  | { type: 'pruning'; log: PruningLog }
  | { type: 'fertilizing'; log: FertilizingLog }
  | { type: 'health'; log: HealthLog }
export type CreateWateringLogInput = z.infer<typeof createWateringLogSchema>
export type CreatePruningLogInput = z.infer<typeof createPruningLogSchema>
export type CreateFertilizingLogInput = z.infer<typeof createFertilizingLogSchema>
export type CreateHealthLogInput = z.infer<typeof createHealthLogSchema>
