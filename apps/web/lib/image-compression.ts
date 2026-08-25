/**
 * Redimensionnement et recompression d'une photo dans le navigateur.
 *
 * Les fonctions serverless de Vercel plafonnent les corps de requête à
 * 4,5 Mo, et une photo d'iPhone les dépasse largement une fois encodée en
 * base64. Compresser avant l'envoi ramène les charges sous 500 Ko et rend
 * l'envoi presque instantané.
 *
 * Extrait de l'écran d'identification, que le diagnostic réutilise tel quel.
 */

/** Plafond avant compression — au-delà, on refuse plutôt que de faire ramer l'onglet. */
export const MAX_FILE_BYTES = 15 * 1024 * 1024

const MAX_DIMENSION = 1920
const JPEG_QUALITY = 0.85

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error ?? new Error('read error'))
    reader.readAsDataURL(file)
  })
}

export async function compressImage(file: File): Promise<string> {
  const sourceUrl = await readFileAsDataURL(file)

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new window.Image()
    i.onload = () => resolve(i)
    i.onerror = () => reject(new Error('image load error'))
    i.src = sourceUrl
  })

  let { width, height } = img
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    const ratio = Math.min(MAX_DIMENSION / width, MAX_DIMENSION / height)
    width = Math.round(width * ratio)
    height = Math.round(height * ratio)
  }

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  // Pas de contexte 2D (navigateur exotique, canvas désactivé) : mieux vaut
  // envoyer l'original que de bloquer l'utilisateur.
  if (!ctx) return sourceUrl
  ctx.drawImage(img, 0, 0, width, height)
  return canvas.toDataURL('image/jpeg', JPEG_QUALITY)
}

/**
 * Valide un fichier choisi par l'utilisateur et le rend prêt à l'envoi.
 * @returns le data URL compressé, ou un message d'erreur affichable.
 */
export async function prepareImageFile(
  file: File,
): Promise<{ dataUrl: string } | { error: string }> {
  if (!file.type.startsWith('image/')) {
    return { error: 'Le fichier doit être une image.' }
  }
  if (file.size > MAX_FILE_BYTES) {
    return { error: 'Image trop volumineuse (maximum 15 Mo).' }
  }
  try {
    return { dataUrl: await compressImage(file) }
  } catch {
    return { error: "Impossible de lire l'image." }
  }
}
