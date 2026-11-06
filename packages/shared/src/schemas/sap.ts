import { z } from 'zod'

import {
  SAP_GIFT_MESSAGE_MAX_LENGTH,
  sapGiftReasonSchema,
  sapKindSchema,
} from '../constants/sap'
import { handleSchema } from './community'
import { cursorPageSchema, idSchema, isoDateTimeSchema, nullish } from './common'

/**
 * La Sève dans l'API v1 — voir `constants/sap.ts` pour le barème et les
 * cernes, et `~/Growi/Documentation/spec/17-plan-seve.md` pour le plan.
 */

/** Un gain de sève, tel que le liste l'historique. */
export const sapEntrySchema = z.object({
  id: idSchema,
  kind: sapKindSchema,
  amount: z.number().int(),
  /**
   * Ce qui a rapporté, figé à l'écriture (« Rosiers paillés à temps »).
   * Absent : l'écran retombe sur `SAP_KIND_LABELS[kind]`.
   */
  label: nullish(z.string()),
  createdAt: isoDateTimeSchema,
})
export type SapEntry = z.infer<typeof sapEntrySchema>

export const sapEntryPageSchema = cursorPageSchema(sapEntrySchema)
export type SapEntryPage = z.infer<typeof sapEntryPageSchema>

/** Où en est la coupe du tronc — voir `sapRings`. */
export const sapRingsSchema = z.object({
  count: z.number().int().min(0),
  floor: z.number().int().min(0),
  next: z.number().int().min(0),
  progress: z.number().min(0).max(1),
  remaining: z.number().int().min(0),
})

/**
 * `GET /api/v1/sap` — tout ce que montrent la carte de l'Accueil et le haut
 * de l'écran « Ta sève », en un appel.
 */
export const sapSummarySchema = z.object({
  total: z.number().int().min(0),
  rings: sapRingsSchema,
  /** Gouttes qu'il reste à offrir cette semaine. */
  giftsLeft: z.number().int().min(0),
  giftsPerWeek: z.number().int().min(0),
  /** Les derniers gains, du plus récent au plus ancien. */
  recent: z.array(sapEntrySchema),
})
export type SapSummary = z.infer<typeof sapSummarySchema>

/**
 * `POST /api/v1/sap/gifts` — offrir une goutte.
 *
 * Le receveur est désigné par son **pseudo** public, comme partout dans la
 * Communauté : un identifiant de compte n'a pas à circuler entre clients.
 * `postId` dit d'où l'on remercie (la publication ouverte), pour la
 * notification ; il n'est pas obligatoire — on peut remercier depuis un profil.
 */
export const giveSapDropSchema = z.object({
  handle: handleSchema,
  reason: sapGiftReasonSchema,
  message: nullish(z.string().trim().max(SAP_GIFT_MESSAGE_MAX_LENGTH)),
  postId: nullish(idSchema),
})
export type GiveSapDropInput = z.infer<typeof giveSapDropSchema>

export const giveSapDropResultSchema = z.object({
  giftsLeft: z.number().int().min(0),
})
export type GiveSapDropResult = z.infer<typeof giveSapDropResultSchema>
