import sharp from 'sharp'

/**
 * Mise au format d'une couverture d'article : recadrage 16:9 centré, largeur
 * 1600 px au plus, JPEG qualité 82.
 *
 * Partagé par l'import des anciens articles et par la génération d'image : une
 * couverture a la même forme quelle que soit son origine, et c'est ce format
 * que le bucket `blog-covers` accepte (JPEG uniquement).
 *
 * Une image plus petite n'est **jamais agrandie** — un agrandissement ne crée
 * pas de détail, il ne fait que peser plus lourd.
 */

export const COVER_WIDTH = 1600
const COVER_RATIO = 16 / 9
const COVER_QUALITY = 82

export async function toCoverJpeg(input: Buffer | Uint8Array): Promise<Uint8Array> {
  // `rotate()` sans argument applique l'orientation EXIF avant le recadrage.
  const oriented = await sharp(input).rotate().toBuffer({ resolveWithObject: true })
  const { width, height } = oriented.info

  // La plus grande zone 16:9 qui tienne dans l'image, centrée.
  const cropWidth = Math.min(width, Math.round(height * COVER_RATIO))
  const cropHeight = Math.min(height, Math.round(cropWidth / COVER_RATIO))
  const targetWidth = Math.min(COVER_WIDTH, cropWidth)

  const jpeg = await sharp(oriented.data)
    .extract({
      left: Math.floor((width - cropWidth) / 2),
      top: Math.floor((height - cropHeight) / 2),
      width: cropWidth,
      height: cropHeight,
    })
    .resize({ width: targetWidth, height: Math.round(targetWidth / COVER_RATIO) })
    .jpeg({ quality: COVER_QUALITY, mozjpeg: true })
    .toBuffer()

  return new Uint8Array(jpeg)
}
