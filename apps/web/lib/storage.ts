/**
 * Stockage des images — Supabase Storage, en REST.
 *
 * L'API Storage se résume à trois appels HTTP : pas de SDK à ajouter pour ça,
 * dans un projet qui ne parle à Supabase que par Prisma.
 *
 * Deux buckets, tous deux **publics en lecture** : les URL sont servies telles
 * quelles par le CDN, ce qui laisse `next/image` et `expo-image` faire leur
 * cache.
 *
 * - `plant-photos` — les photos des utilisateurs. Ce qui y protège la vie
 *   privée n'est pas un jeton mais l'imprévisibilité du chemin — et surtout la
 *   suppression, assurée à la suppression de la plante comme au remplacement
 *   de sa photo.
 * - `blog-covers` — les couvertures des articles du blog, JPEG uniquement.
 *
 * Les deux buckets ont été créés par migration Supabase (`storage.buckets`),
 * pas par Prisma. Seule la clé service y écrit.
 */

import { randomUUID } from 'node:crypto'

import type { PhotoKind } from '@growi/shared'

import { ServiceError } from '@/lib/services/errors'

const BUCKET = 'plant-photos'
const COVERS_BUCKET = 'blog-covers'

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

/** URL publique d'un objet du bucket des photos. */
export function publicUrl(path: string): string {
  return publicUrlIn(BUCKET, path)
}

function publicUrlIn(bucket: string, path: string): string {
  return `${config().url}/storage/v1/object/public/${bucket}/${path}`
}

/**
 * Chemin interne d'une de nos URL, ou `null` si l'URL vient d'ailleurs —
 * une photo du catalogue, par exemple, qu'il ne faut surtout pas supprimer.
 */
export function pathFromUrl(url: string | null | undefined): string | null {
  return pathIn(BUCKET, url)
}

function pathIn(bucket: string, url: string | null | undefined): string | null {
  if (!url) return null

  const prefix = `${config().url}/storage/v1/object/public/${bucket}/`
  return url.startsWith(prefix) ? url.slice(prefix.length) : null
}

/**
 * Supprime une photo dont on a l'URL. Sans effet si elle n'est pas à nous.
 *
 * L'échec n'est jamais propagé : perdre un objet orphelin est moins grave que
 * de faire échouer la suppression d'une plante.
 */
export async function deletePhotoByUrl(url: string | null | undefined): Promise<void> {
  await deleteObject(BUCKET, url)
}

async function deleteObject(bucket: string, url: string | null | undefined): Promise<void> {
  const path = pathIn(bucket, url)
  if (!path) return

  try {
    const { url: baseUrl, key } = config()
    const response = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${path}`, {
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

// ─── Suppression de compte ─────────────────────────────────────────────────

/** Plafond de l'API Storage pour une suppression groupée. */
const BULK_DELETE_MAX = 1000

/** Supprime des chemins du bucket photos, par lots. Rend le nombre d'échecs. */
async function deletePaths(paths: string[]): Promise<number> {
  if (paths.length === 0) return 0
  const { url, key } = config()
  let failures = 0

  for (let i = 0; i < paths.length; i += BULK_DELETE_MAX) {
    const batch = paths.slice(i, i + BULK_DELETE_MAX)
    const response = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefixes: batch }),
    })
    if (!response.ok) {
      console.error('[storage] suppression groupée refusée :', response.status)
      failures += batch.length
    }
  }

  return failures
}

type StorageEntry = { name: string; id: string | null }

/**
 * Tous les fichiers sous un préfixe, sous-dossiers compris. L'API ne liste
 * qu'un niveau à la fois : un dossier y apparaît avec un `id` nul.
 */
async function listRecursive(prefix: string): Promise<string[]> {
  const { url, key } = config()
  const files: string[] = []
  const PAGE = 1000

  for (let offset = 0; ; offset += PAGE) {
    const response = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prefix, limit: PAGE, offset }),
    })
    if (!response.ok) {
      throw new Error(`liste refusée (${response.status}) pour ${prefix}`)
    }

    const entries = (await response.json()) as StorageEntry[]
    for (const entry of entries) {
      const path = `${prefix}${entry.name}`
      if (entry.id === null) files.push(...(await listRecursive(`${path}/`)))
      else files.push(path)
    }
    if (entries.length < PAGE) return files
  }
}

/**
 * Efface tout ce qu'un compte a déposé : le dossier `users/{userId}/` entier.
 *
 * Par dossier plutôt que par relevé des URL en base : le chemin est choisi par
 * le serveur (`uploadPhoto`), donc tout ce qui vient du compte est là — y
 * compris les kinds ajoutés après coup, et les fichiers qu'aucune ligne ne
 * référence plus. Un relevé colonne par colonne en oublierait un jour.
 *
 * **Ne lève jamais** : la suppression du compte a déjà eu lieu quand on
 * arrive ici, et un fichier orphelin ne doit pas la faire paraître ratée.
 * Rend le nombre de fichiers qui n'ont pas pu être effacés.
 */
export async function deleteUserFolder(userId: string): Promise<number> {
  try {
    return await deletePaths(await listRecursive(`users/${userId}/`))
  } catch (error) {
    console.error('[storage] purge du dossier impossible :', userId, error)
    return -1
  }
}

/**
 * Supprime des photos dont on a les URL, en un appel. Ignore celles qui ne
 * sont pas à nous. Même contrat que `deleteUserFolder` : ne lève jamais.
 */
export async function deletePhotosByUrl(
  urls: Array<string | null | undefined>,
): Promise<number> {
  try {
    const paths = urls.map((url) => pathFromUrl(url)).filter((p): p is string => p !== null)
    return await deletePaths(paths)
  } catch (error) {
    console.error('[storage] suppression groupée impossible :', error)
    return -1
  }
}

// ─── Couvertures du blog ───────────────────────────────────────────────────

/** Même forme que `generatedArticleSchema.slug` : rien qui puisse sortir du dossier. */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

/**
 * Dépose la couverture d'un article, déjà recadrée et compressée en JPEG, et
 * renvoie son URL publique.
 *
 * Un chemin neuf à chaque dépôt (`<slug>/cover-<horodatage>.jpg`) : l'ancienne
 * couverture reste servie jusqu'à ce que la nouvelle soit enregistrée, puis se
 * supprime par `deleteCoverByUrl`. Comme aucune URL n'est jamais réécrite, le
 * cache peut être long — contrairement aux photos des utilisateurs, une
 * couverture n'a rien de personnel.
 *
 * @throws ServiceError('INVALID_INPUT') si le slug ou l'image sont invalides,
 * ServiceError('UNAVAILABLE') si le stockage ne répond pas.
 */
export async function uploadCover(
  slug: string,
  jpegBytes: Uint8Array,
): Promise<{ url: string; path: string }> {
  if (!SLUG_PATTERN.test(slug)) {
    throw new ServiceError('INVALID_INPUT', 'Slug invalide pour une couverture.')
  }
  if (sniffImageType(jpegBytes) !== 'image/jpeg') {
    throw new ServiceError('INVALID_INPUT', 'Une couverture doit être un JPEG.')
  }

  const path = `${slug}/cover-${Date.now()}.jpg`
  const { url, key } = config()

  const response = await fetch(`${url}/storage/v1/object/${COVERS_BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'image/jpeg',
      'x-upsert': 'false',
      'cache-control': 'max-age=31536000',
    },
    body: jpegBytes as unknown as BodyInit,
  })

  if (!response.ok) {
    console.error('[storage] couverture refusée :', response.status, await response.text())
    throw new ServiceError('UNAVAILABLE', "La couverture n'a pas pu être enregistrée.")
  }

  return { url: publicUrlIn(COVERS_BUCKET, path), path }
}

/**
 * Supprime une couverture dont on a l'URL. Sans effet si elle n'est pas dans
 * `blog-covers` — une photo d'utilisateur ne peut pas être effacée par ce biais.
 * Ne lève jamais.
 */
export async function deleteCoverByUrl(url: string | null | undefined): Promise<void> {
  await deleteObject(COVERS_BUCKET, url)
}
