import { z } from 'zod'

/** Contrat de `POST /api/v1/identify` — identification d'une plante par photo. */

export const IDENTIFY_CONFIDENCES = ['high', 'medium', 'low'] as const
export const identifyConfidenceSchema = z.enum(IDENTIFY_CONFIDENCES)
export type IdentifyConfidence = z.infer<typeof identifyConfidenceSchema>

export const IDENTIFY_DIFFICULTIES = ['easy', 'medium', 'demanding'] as const
export const identifyDifficultySchema = z.enum(IDENTIFY_DIFFICULTIES)
export type IdentifyDifficulty = z.infer<typeof identifyDifficultySchema>

export const identifyCareGuideSchema = z.object({
  watering: z.string(),
  light: z.string(),
  soil: z.string(),
  temperature: z.string(),
  difficulty: identifyDifficultySchema,
})

export type IdentifyCareGuide = z.infer<typeof identifyCareGuideSchema>

export const identifySuccessSchema = z.object({
  identified: z.literal(true),
  confidence: identifyConfidenceSchema,
  commonName: z.string(),
  scientificName: z.string(),
  family: z.string(),
  emoji: z.string(),
  shortDescription: z.string(),
  careGuide: identifyCareGuideSchema,
  funFact: z.string(),
  warnings: z.array(z.string()),
  tags: z.array(z.string()),
})

export type IdentifySuccess = z.infer<typeof identifySuccessSchema>

export const identifyFailureSchema = z.object({
  identified: z.literal(false),
  reason: z.string(),
})

export type IdentifyFailure = z.infer<typeof identifyFailureSchema>

export type IdentifyResult = IdentifySuccess | IdentifyFailure

/** Résultat enrichi du rapprochement avec l'encyclopédie Growi. */
export type IdentifyApiResponse = IdentifyResult & {
  encyclopediaSlug: string | null
  encyclopediaName: string | null
}

/** Corps de la requête : photo en data URL base64, 4 Mo maximum. */
export const identifyRequestSchema = z.object({
  imageBase64: z.string().min(1, 'Image requise'),
})

export type IdentifyRequest = z.infer<typeof identifyRequestSchema>
