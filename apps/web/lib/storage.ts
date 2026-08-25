/**
 * Stockage des photos — Supabase Storage, en REST.
 *
 * L'API Storage se résume à trois appels HTTP : pas de SDK à ajouter pour ça,
 * dans un projet qui ne parle à Supabase que par Prisma.
 *
 * Le bucket `plant-photos` est **public en lecture** : les URL sont servies
 * telles quelles par le CDN, ce qui laisse `next/image` et `expo-image` faire
 * leur cache. Ce qui protège la vie privée ici n'est pas un jeton mais
 * l'imprévisibilité du chemin — et surtout la suppression, assurée à la
 * suppression de la plante comme au remplacement de sa photo.
 */

import { randomUUID } from 'node:crypto'

import type { PhotoKind } from '@growi/shared'

import { ServiceError } from '@/lib/services/errors'

const BUCKET = 'plant-photos'

/** Limites appliquées côté serveur : le client peut mentir sur les deux. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export type AllowedImageType = (typeof ALLOWED_IMAGE_TYPES)[number]

const EXTENSIONS: Record<AllowedImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

/**
 * Signature de fichier, vérifiée sur les premiers octets.
 *
 * Un `Content-Type` est déclaratif : rien n'empêche d'envoyer un exécutable
 * en l'annonçant comme une image. On regarde donc ce que le fichier est
 * vraiment.
 */
function sniffImageType(bytes: Uint8Array): AllowedImageType | null {
  if (bytes.length < 12) return null

  // JPEG : FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'

  // PNG : 89 50 4E 47 0D 0A 1A 0A
  const png = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  if (png.every((byte, i) => bytes[i] === byte)) return 'image/png'

  // WebP : "RIFF" …… "WEBP"
  const ascii = (start: number, end: number) =>
    String.fromCharCode(...bytes.slice(start, end))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp'

  return null
}

function config(): { url: string; key: string } {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    // Une configuration absente est une panne de notre côté, pas une erreur
    // de saisie : on ne laisse pas croire à l'utilisateur qu'il a mal fait.
    throw new ServiceError('UNAVAILABLE', "L'envoi de photos est indisponible.")
  }

  return { url: url.replace(/\/$/, ''), key }
}

// Le domaine des kinds appartient à @growi/shared : le redéclarer ici laissait
// les deux listes diverger en silence (le chemin de rangement en dépend).
export type { PhotoKind } from '@growi/shared'

/**
 * Dépose une image et renvoie son URL publique.
 *
 * Le chemin est choisi par le serveur — jamais par le client — et préfixé par
 * l'identifiant du propriétaire : une photo ne peut pas en écraser une autre,
 * ni atterrir chez quelqu'un d'autre.
 *
 * @throws ServiceError('INVALID_INPUT') si l'image est trop lourde ou d'un
 * type refusé, ServiceError('UNAVAILABLE') si le stockage ne répond pas.
 */
export async function uploadPhoto(
  userId: string,
  kind: PhotoKind,
  file: { bytes: ArrayBuffer; contentType: string },
): Promise<{ url: string; path: string }> {
  const bytes = new Uint8Array(file.bytes)

  if (bytes.byteLength === 0) {
    throw new ServiceError('INVALID_INPUT', 'Le fichier est vide.')
  }
  if (bytes.byteLength > MAX_UPLOAD_BYTES) {
    throw new ServiceError('INVALID_INPUT', 'La photo dépasse 5 Mo.')
  }

  const detected = sniffImageType(bytes)
  if (!detected) {
    throw new ServiceError(
      'INVALID_INPUT',
      'Format non reconnu. Envoie une image JPEG, PNG ou WebP.',
    )
  }

  const path = `users/${userId}/${kind}/${randomUUID()}.${EXTENSIONS[detected]}`
  const { url, key } = config()

  const response = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': detected,
      // Un chemin neuf à chaque fois : rien à écraser.
      'x-upsert': 'false',
      // Pas d'en-tête de cache : Supabase sert alors `no-cache`, le CDN
      // revalide, et une photo supprimée cesse d'être servie presque
      // aussitôt — une URL déjà mise en cache peut survivre une minute, pas
      // davantage. Un cache long l'aurait laissée accessible des mois après
      // son effacement, mauvais compromis pour une donnée personnelle ;
      // `expo-image` et `next/image` gardent de toute façon leur propre cache.
    },
    body: bytes as unknown as BodyInit,
  })

  if (!response.ok) {
    console.error('[storage] envoi refusé :', response.status, await response.text())
    throw new ServiceError('UNAVAILABLE', "La photo n'a pas pu être enregistrée.")
  }

  return { url: publicUrl(path), path }
}

/** URL publique d'un objet du bucket. */
export function publicUrl(path: string): string {
  return `${config().url}/storage/v1/object/public/${BUCKET}/${path}`
}

/**
 * Chemin interne d'une de nos URL, ou `null` si l'URL vient d'ailleurs —
 * une photo du catalogue, par exemple, qu'il ne faut surtout pas supprimer.
 */
export function pathFromUrl(url: string | null | undefined): string | null {
  if (!url) return null

  const prefix = `${config().url}/storage/v1/object/public/${BUCKET}/`
  return url.startsWith(prefix) ? url.slice(prefix.length) : null
}

/**
 * Supprime une photo dont on a l'URL. Sans effet si elle n'est pas à nous.
 *
 * L'échec n'est jamais propagé : perdre un objet orphelin est moins grave que
 * de faire échouer la suppression d'une plante.
 */
export async function deletePhotoByUrl(url: string | null | undefined): Promise<void> {
  const path = pathFromUrl(url)
  if (!path) return

  try {
    const { url: baseUrl, key } = config()
    const response = await fetch(`${baseUrl}/storage/v1/object/${BUCKET}/${path}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}` },
    })

    if (!response.ok) {
      console.error('[storage] suppression refusée :', response.status, path)
    }
  } catch (error) {
    console.error('[storage] suppression impossible :', error)
  }
}
