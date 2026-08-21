import { z } from 'zod'

import { careLogTypeSchema, healthStatusSchema } from '../constants/enums'
import { idSchema, isoDateTimeSchema, nullish } from './common'

/**
 * Journal d'entretien unifié.
 *
 * Un seul type de log couvre tous les gestes : ajouter la récolte, le
 * traitement ou le rempotage est désormais une valeur d'énumération, non une
 * table, un endpoint et une branche d'union supplémentaires.
 */

// ─── Entité ────────────────────────────────────────────────────────────────

export const careLogSchema = z.object({
  id: idSchema,
  plantInstanceId: idSchema,
  type: careLogTypeSchema,
  occurredAt: isoDateTimeSchema,
  note: nullish(z.string()),
  /** Produit employé : engrais, traitement, substrat… (« marc de café »). */
  productUsed: nullish(z.string()),
  /** Renseigné pour les gestes de type `health`. */
  status: nullish(z.string()),
  /** Quantité récoltée, avec son unité. */
  quantity: nullish(z.number()),
  unit: nullish(z.string()),
  photoUrl: nullish(z.string()),
  createdAt: isoDateTimeSchema,
})

export type CareLog = z.infer<typeof careLogSchema>

/** Historique d'une plante, du plus récent au plus ancien. */
export const careLogsSchema = z.array(careLogSchema)
export type CareLogs = z.infer<typeof careLogsSchema>

// ─── Création ──────────────────────────────────────────────────────────────

export const HARVEST_UNITS = ['g', 'kg', 'pièce', 'botte', 'L'] as const
export const harvestUnitSchema = z.enum(HARVEST_UNITS)
export type HarvestUnit = z.infer<typeof harvestUnitSchema>

/**
 * Forme plurielle de chaque unité.
 *
 * Les symboles (g, kg, L) sont invariables ; seuls les noms s'accordent. Toute
 * unité ajoutée doit déclarer son pluriel ici plutôt que de se voir coller un
 * « s » à l'affichage.
 */
const HARVEST_UNIT_PLURALS: Record<HarvestUnit, string> = {
  g: 'g',
  kg: 'kg',
  L: 'L',
  pièce: 'pièces',
  botte: 'bottes',
}

/**
 * Quantité récoltée telle qu'on l'écrit : « 3 bottes », « 1,2 kg ».
 *
 * En français le pluriel commence à 2 — 1,2 kg reste au singulier. La virgule
 * décimale est rendue localement plutôt que par `Intl`, dont Hermes ne garantit
 * pas la présence sur tous les appareils.
 */
export function formatHarvest(quantity: number, unit?: string | null): string {
  const amount = String(quantity).replace('.', ',')
  if (!unit) return amount

  const plural = HARVEST_UNIT_PLURALS[unit as HarvestUnit]
  if (!plural) return `${amount} ${unit}`

  return `${amount} ${quantity >= 2 ? plural : unit}`
}

/**
 * Corps de `POST /api/v1/plants/[id]/logs`.
 *
 * Tous les champs sont facultatifs sauf le type : un geste rapide se résume à
 * `{ type: 'watering' }`, et la précision est optionnelle. Les combinaisons
 * incohérentes sont écartées par les refinements ci-dessous plutôt que par une
 * union discriminée, qui rendait l'ajout d'un type coûteux.
 */
export const createCareLogSchema = z
  .object({
    type: careLogTypeSchema,
    occurredAt: z.iso.datetime().optional(),
    note: z.string().max(500).optional(),
    productUsed: z.string().max(100).optional(),
    status: healthStatusSchema.optional(),
    quantity: z.number().positive().max(100_000).optional(),
    unit: harvestUnitSchema.optional(),
    photoUrl: z.string().max(2000).optional(),
  })
  .refine((input) => input.type !== 'health' || input.status !== undefined, {
    message: 'Un état de santé est requis pour une note de santé',
    path: ['status'],
  })
  .refine((input) => input.quantity === undefined || input.unit !== undefined, {
    message: 'Précise une unité avec la quantité',
    path: ['unit'],
  })

export type CreateCareLogInput = z.infer<typeof createCareLogSchema>
