import sharp from 'sharp'
import { describe, expect, it } from 'vitest'

import { toCoverJpeg } from '@/lib/blog/cover-image'

function png(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 30, g: 86, b: 49 } },
  }).png().toBuffer()
}

describe('toCoverJpeg', () => {
  it('recadre en 16:9 et plafonne la largeur à 1600 px', async () => {
    const jpeg = await toCoverJpeg(await png(3000, 3000))
    const meta = await sharp(jpeg).metadata()

    expect(meta.format).toBe('jpeg')
    expect(meta.width).toBe(1600)
    expect(meta.height).toBe(900)
  })

  it('n\'agrandit jamais une image plus petite', async () => {
    const meta = await sharp(await toCoverJpeg(await png(1200, 630))).metadata()

    expect(meta.width).toBe(1120)
    expect(meta.height).toBe(630)
  })
})
