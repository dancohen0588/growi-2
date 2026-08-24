import { z } from 'zod'

/**
 * Contrat de `POST /api/v1/uploads` — dépôt d'une photo.
 *
 * Le corps est un `multipart/form-data` (champs `file` et `kind`), pas du
 * JSON : encoder une image en base64 l'alourdit d'un tiers pour rien.
 */

/** À quoi la photo est destinée — le serveur en tire le chemin de rangement. */
export const PHOTO_KINDS = ['plant', 'care-log', 'diagnosis'] as const
export const photoKindSchema = z.enum(PHOTO_KINDS)
export type PhotoKind = z.infer<typeof photoKindSchema>

export const uploadedPhotoSchema = z.object({
  /** URL publique, à écrire telle quelle dans `photoUrl`. */
  url: z.string(),
})

export type UploadedPhoto = z.infer<typeof uploadedPhotoSchema>
