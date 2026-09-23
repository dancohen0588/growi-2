import sharp from 'sharp'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// L'API image est doublée ; le recadrage `sharp`, lui, est réel.

const generateContent = vi.hoisted(() => vi.fn())
vi.mock('@google/genai', () => ({
  GoogleGenAI: class {
    models = { generateContent }
  },
}))

vi.mock('@sentry/nextjs', () => ({
  captureMessage: vi.fn(),
  startSpan: (_options: unknown, run: () => unknown) => run(),
}))

const storage = vi.hoisted(() => ({ uploadCover: vi.fn(), deleteCoverByUrl: vi.fn() }))
vi.mock('@/lib/storage', () => storage)

const prismaMock = vi.hoisted(() => ({
  blogPost: { findUnique: vi.fn(), update: vi.fn(), findFirst: vi.fn() },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { describeError, generateCover, findPendingCover } = await import('../blog-cover.service')

const OLD_COVER = 'https://ref.supabase.co/storage/v1/object/public/blog-covers/ail/cover-1.jpg'
const NEW_COVER = 'https://ref.supabase.co/storage/v1/object/public/blog-covers/ail/cover-2.jpg'

const POST = {
  id: 'post_1',
  slug: 'ail',
  coverImage: OLD_COVER,
  coverPrompt: 'Garlic cloves planted along a stone wall. No people, no text, no logos, no watermark.',
  generation: { textModel: 'gemini-2.5-flash' },
}

async function imageResponse() {
  const png = await sharp({ create: { width: 1344, height: 768, channels: 3, background: '#1E5631' } }).png().toBuffer()
  return { candidates: [{ content: { parts: [{ inlineData: { mimeType: 'image/png', data: png.toString('base64') } }] } }] }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('GEMINI_API_KEY', 'test-key')
  prismaMock.blogPost.findUnique.mockResolvedValue(POST)
  prismaMock.blogPost.update.mockResolvedValue({})
  storage.uploadCover.mockResolvedValue({ url: NEW_COVER, path: 'ail/cover-2.jpg' })
})

describe('generateCover', () => {
  it('demande une image 16:9, la recadre en JPEG et la rend prête', async () => {
    generateContent.mockResolvedValue(await imageResponse())

    const result = await generateCover('post_1', { budgetMs: 40_000 })

    expect(result).toMatchObject({ ok: true, url: NEW_COVER })
    const request = generateContent.mock.calls[0][0]
    expect(request.model).toBe('gemini-2.5-flash-image')
    expect(request.config.imageConfig).toEqual({ aspectRatio: '16:9' })

    const [slug, jpeg] = storage.uploadCover.mock.calls[0]
    expect(slug).toBe('ail')
    const meta = await sharp(Buffer.from(jpeg)).metadata()
    expect(meta.format).toBe('jpeg')
    expect(meta.width! / meta.height!).toBeCloseTo(16 / 9, 2)

    expect(prismaMock.blogPost.update.mock.calls[0][0].data).toMatchObject({
      coverImage: NEW_COVER,
      coverStatus: 'READY',
      generation: { textModel: 'gemini-2.5-flash', imageModel: 'gemini-2.5-flash-image' },
    })
  })

  it('supprime l\'ancienne couverture après l\'écriture, jamais avant', async () => {
    generateContent.mockResolvedValue(await imageResponse())
    const order: string[] = []
    prismaMock.blogPost.update.mockImplementation(async () => { order.push('update') })
    storage.deleteCoverByUrl.mockImplementation(async () => { order.push('delete') })

    await generateCover('post_1', { budgetMs: 40_000 })

    expect(storage.deleteCoverByUrl).toHaveBeenCalledWith(OLD_COVER)
    expect(order).toEqual(['update', 'delete'])
  })

  it('utilise le prompt ajusté depuis l\'admin, clôture comprise', async () => {
    generateContent.mockResolvedValue(await imageResponse())

    await generateCover('post_1', { prompt: 'Strawberry plants on straw mulch', budgetMs: 40_000 })

    expect(generateContent.mock.calls[0][0].contents)
      .toBe('Strawberry plants on straw mulch. No people, no text, no logos, no watermark.')
  })

  it('un échec ne lève pas, laisse PENDING et garde l\'image existante', async () => {
    generateContent.mockRejectedValue(Object.assign(new Error('overloaded'), { status: 503 }))

    const result = await generateCover('post_1', { budgetMs: 40_000 })

    expect(result).toMatchObject({ ok: false })
    const { data } = prismaMock.blogPost.update.mock.calls[0][0]
    expect(data.coverStatus).toBe('PENDING')
    expect(data).not.toHaveProperty('coverImage')
    expect(storage.deleteCoverByUrl).not.toHaveBeenCalled()
  })

  it('une réponse sans image (refus du modèle) est un échec, pas une exception', async () => {
    generateContent.mockResolvedValue({ candidates: [{ finishReason: 'IMAGE_SAFETY', content: { parts: [] } }] })

    expect(await generateCover('post_1', { budgetMs: 40_000 })).toMatchObject({ ok: false, reason: expect.stringMatching(/IMAGE_SAFETY/) })
  })

  it('ne tente rien sans clé, ni sans le temps de finir', async () => {
    vi.stubEnv('GEMINI_API_KEY', '')
    expect(await generateCover('post_1', { budgetMs: 40_000 })).toMatchObject({ ok: false })

    vi.stubEnv('GEMINI_API_KEY', 'test-key')
    expect(await generateCover('post_1', { budgetMs: 10_000 })).toMatchObject({ ok: false })

    expect(generateContent).not.toHaveBeenCalled()
  })

  it('un stockage indisponible laisse aussi la couverture à produire', async () => {
    generateContent.mockResolvedValue(await imageResponse())
    storage.uploadCover.mockRejectedValue(new Error('507'))

    expect(await generateCover('post_1', { budgetMs: 40_000 })).toMatchObject({ ok: false })
    expect(prismaMock.blogPost.update.mock.calls[0][0].data.coverStatus).toBe('PENDING')
  })
})

describe('findPendingCover', () => {
  it('cherche la plus ancienne couverture en attente qui a un prompt', async () => {
    prismaMock.blogPost.findFirst.mockResolvedValue(null)

    await findPendingCover('post_2')

    expect(prismaMock.blogPost.findFirst).toHaveBeenCalledWith(expect.objectContaining({
      where: { coverStatus: 'PENDING', coverPrompt: { not: null }, id: { not: 'post_2' } },
      orderBy: { createdAt: 'asc' },
    }))
  })
})

describe('describeError', () => {
  it('résume le JSON d\'erreur de l\'API en une phrase', () => {
    const freeTier = new Error(JSON.stringify({
      error: { code: 429, message: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 0' },
    }))

    expect(describeError(freeTier)).toMatch(/offre gratuite.*facturation/)
    expect(describeError(Object.assign(new Error('x'), { status: 503 }))).toMatch(/surchargé/)
    expect(describeError(new Error('ligne 1\nligne 2'))).toBe('ligne 1')
  })
})
