import { z } from 'zod'

/**
 * Identifiant d'entité. Prisma génère des cuid, mais on reste volontairement
 * permissif : l'API ne doit pas rejeter un identifiant légitime au motif d'un
 * format légèrement différent.
 */
export const idSchema = z.string().min(1)

/**
 * Date sérialisée en ISO 8601.
 *
 * Convention : les schémas d'**entité** de ce package décrivent la
 * représentation **JSON** renvoyée par l'API v1, où les dates sont des chaînes
 * ISO. Côté web, les Server Components manipulent encore des objets `Date`
 * issus de Prisma — c'est la couche de sérialisation des routes `/api/v1/*`
 * (étape 2.2) qui fait la conversion.
 */
export const isoDateTimeSchema = z.iso.datetime()

/** Champ optionnel et potentiellement `null` (colonne Prisma nullable). */
export function nullish<T extends z.ZodType>(schema: T) {
  return schema.nullable().optional()
}

/** Enveloppe de succès de l'API v1. */
export function apiSuccessSchema<T extends z.ZodType>(dataSchema: T) {
  return z.object({ data: dataSchema })
}

/** Enveloppe d'erreur de l'API v1. */
export const apiErrorSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
})

export type ApiError = z.infer<typeof apiErrorSchema>
