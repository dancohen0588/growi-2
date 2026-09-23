import { beforeEach, describe, expect, it, vi } from 'vitest'

import { validMdx } from '@/lib/__tests__/fixtures/blog-article'

// ─── Doublures ─────────────────────────────────────────────────────────────
//
// Gemini est doublé : chaque test écrit ce que « répond le modèle ». Prisma
// aussi, comme partout dans les tests unitaires. La compilation MDX, elle, est
// réelle — c'est précisément l'un des contrôles qu'on veut voir jouer.

const generateJson = vi.hoisted(() => vi.fn())

vi.mock('@/lib/services/gemini', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/services/gemini')>()),
  generateJson,
  requireGeminiKey: () => 'test-key',
}))

vi.mock('@sentry/nextjs', () => ({ captureMessage: vi.fn(), startSpan: vi.fn() }))

const prismaMock = vi.hoisted(() => ({
  blogPost: {
    count: vi.fn(),
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const { generateArticle } = await import('../blog-generator.service')
const { ServiceError } = await import('../errors')

// ─── Fixtures ──────────────────────────────────────────────────────────────

const TODAY = new Date('2026-09-15T08:00:00Z')
const now = () => TODAY

const EXISTING = [
  { title: 'Préparer son potager en septembre', slug: 'preparer-son-potager-en-septembre', tags: ['potager', 'saison'], status: 'PUBLISHED', publishedAt: new Date('2026-08-19'), createdAt: new Date('2026-08-19') },
  { title: 'Oïdium, mildiou, rouille : reconnaître les trois maladies', slug: 'reconnaitre-oidium-mildiou-rouille', tags: ['maladies', 'entretien'], status: 'PUBLISHED', publishedAt: new Date('2026-08-12'), createdAt: new Date('2026-08-12') },
]

function modelSays(payload: unknown) {
  return { ok: true, raw: JSON.stringify(payload), model: 'gemini-2.5-flash', fallback: false, usage: { inputTokens: 1000, outputTokens: 2000, totalTokens: 3000 } }
}

function topics(...candidates: Array<{ title: string; tags: string[] }>) {
  return modelSays({
    candidates: candidates.map(c => ({ ...c, angle: 'Ce que le lecteur apprend.', why: 'La saison s’y prête.' })),
  })
}

function article(overrides: Record<string, unknown> = {}) {
  return modelSays({
    title: 'Planter ses bulbes de printemps en octobre',
    slug: 'planter-ses-bulbes-de-printemps-en-octobre',
    excerpt: 'Profondeur, espacement et bon moment : tout pour que tes tulipes et narcisses fleurissent au printemps.',
    tags: ['saison'],
    mdx: validMdx(),
    coverPrompt: 'Tulip bulbs being planted in dark soil along an old stone wall in a French garden, low morning light',
    coverImageAlt: 'Bulbes de tulipes posés dans un sillon au pied d’un muret en pierre',
    reviewerNotes: ['Planter à trois fois la hauteur du bulbe'],
    ...overrides,
  })
}

const run = (overrides: Partial<Parameters<typeof generateArticle>[0]> = {}) =>
  generateArticle({ origin: 'cron', timeBudgetMs: 55_000, now, ...overrides })

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.blogPost.count.mockResolvedValue(0)
  prismaMock.blogPost.findMany.mockResolvedValue(EXISTING)
  prismaMock.blogPost.findUnique.mockResolvedValue(null)
  prismaMock.blogPost.create.mockImplementation(async ({ data }) => ({ id: 'post_1', ...data }))
})

// ─── Cas nominal ───────────────────────────────────────────────────────────

describe('génération d\'un article', () => {
  it('écrit un brouillon, couverture en attente, avec notes et raison du thème', async () => {
    generateJson
      .mockResolvedValueOnce(topics({ title: 'Planter ses bulbes de printemps', tags: ['saison'] }))
      .mockResolvedValueOnce(article())

    const result = await run()

    expect(result.ok).toBe(true)
    const { data } = prismaMock.blogPost.create.mock.calls[0][0]
    expect(data).toMatchObject({
      status: 'DRAFT',
      coverStatus: 'PENDING',
      origin: 'cron',
      topicRationale: 'La saison s’y prête.',
      reviewerNotes: ['Planter à trois fois la hauteur du bulbe'],
    })
    // La clôture du prompt d'image est ajoutée par le code, même oubliée.
    expect(data.coverPrompt).toMatch(/No people, no text, no logos, no watermark\.$/)
    expect(data.generation).toMatchObject({ textModel: 'gemini-2.5-flash', attempts: 1, usage: { inputTokens: 2000, outputTokens: 4000 } })
  })

  it('écrit avec de la variété, choisit le thème avec retenue', async () => {
    generateJson
      .mockResolvedValueOnce(topics({ title: 'Planter ses bulbes de printemps', tags: ['saison'] }))
      .mockResolvedValueOnce(article())

    await run()

    const [topicCall, articleCall] = generateJson.mock.calls
    expect(topicCall[1].temperature).toBeLessThan(articleCall[1].temperature)
  })
})

// ─── Choix du thème ────────────────────────────────────────────────────────

describe('choix du thème', () => {
  it('donne au modèle les tags du moins fourni au plus fourni', async () => {
    generateJson
      .mockResolvedValueOnce(topics({ title: 'Planter ses bulbes de printemps', tags: ['saison'] }))
      .mockResolvedValueOnce(article())

    await run()

    const prompt: string = generateJson.mock.calls[0][0][0].text
    // Inventaire : potager 1, saison 1, maladies 1, entretien 1 — égalité, ordre de BLOG_TAGS.
    expect(prompt.indexOf('saison (')).toBeLessThan(prompt.indexOf('maladies ('))
    expect(prompt).toContain('Préparer son potager en septembre')
  })

  it('écarte un candidat qui double un titre existant, et un candidat sans tag automatique', async () => {
    generateJson
      .mockResolvedValueOnce(topics(
        { title: 'Bien préparer le potager en septembre', tags: ['potager'] },
        { title: 'Growi fait peau neuve', tags: ['actus-growi'] },
        { title: 'Planter ses bulbes de printemps', tags: ['saison'] },
      ))
      .mockResolvedValueOnce(article())

    await run()

    const articlePrompt: string = generateJson.mock.calls[1][0][1].text
    expect(articlePrompt).toContain('Titre de travail : Planter ses bulbes de printemps')
  })

  it('abandonne quand les trois candidats doublent l\'existant', async () => {
    generateJson.mockResolvedValueOnce(topics(
      { title: 'Préparer son potager en septembre', tags: ['potager'] },
      { title: 'Préparer le potager en septembre', tags: ['potager'] },
      { title: 'Oïdium, mildiou, rouille : reconnaître les maladies', tags: ['maladies'] },
    ))

    const result = await run()

    expect(result).toMatchObject({ ok: false, stage: 'topic' })
    expect(prismaMock.blogPost.create).not.toHaveBeenCalled()
  })

  it('un sujet imposé saute le choix du thème', async () => {
    generateJson.mockResolvedValueOnce(article())

    const result = await run({ origin: 'admin', actorId: 'admin_1', topic: 'Les bulbes de printemps' })

    expect(result.ok).toBe(true)
    expect(generateJson).toHaveBeenCalledTimes(1)
    expect(generateJson.mock.calls[0][0][1].text).toContain('Titre de travail : Les bulbes de printemps')
    expect(prismaMock.blogPost.create.mock.calls[0][0].data.generation.requestedBy).toBe('admin_1')
  })
})

// ─── Contrôles ─────────────────────────────────────────────────────────────

describe('contrôles avant écriture', () => {
  const topic = { origin: 'admin' as const, topic: 'Les bulbes de printemps' }

  it('rejette un article qui contient « IA », deux fois, puis abandonne', async () => {
    const withIA = article({ mdx: validMdx('Cet article a été rédigé avec une IA.') })
    generateJson.mockResolvedValueOnce(withIA).mockResolvedValueOnce(withIA)

    const result = await run(topic)

    expect(result).toMatchObject({ ok: false, stage: 'check' })
    expect(result.ok || result.issues?.join()).toMatch(/Termes interdits/)
    expect(prismaMock.blogPost.create).not.toHaveBeenCalled()
  })

  it('la reprise reçoit les défauts de la première version, et peut réussir', async () => {
    generateJson
      .mockResolvedValueOnce(article({ mdx: validMdx('Cet article a été rédigé avec une IA.') }))
      .mockResolvedValueOnce(article())

    const result = await run(topic)

    expect(result).toMatchObject({ ok: true, attempts: 2 })
    expect(generateJson.mock.calls[1][0][1].text).toMatch(/refusée[\s\S]*Termes interdits/)
    expect(prismaMock.blogPost.create.mock.calls[0][0].data.generation.rejected).toHaveLength(1)
  })

  it('rejette un MDX qui ne compile pas', async () => {
    // Encadré jamais refermé : le lint ne le voit pas, le compilateur si.
    const broken = article({ mdx: validMdx('<Callout tone="attention">Sans fin') })
    generateJson.mockResolvedValueOnce(broken).mockResolvedValueOnce(broken)

    const result = await run(topic)

    expect(result).toMatchObject({ ok: false, stage: 'check' })
    expect(result.ok || result.issues?.join()).toMatch(/ne compile pas/)
  })

  it('refuse un titre qui double un article existant, et un slug déjà pris', async () => {
    prismaMock.blogPost.findUnique.mockResolvedValue({ id: 'déjà là' })
    const duplicate = article({ title: 'Préparer son potager en septembre' })
    generateJson.mockResolvedValueOnce(duplicate).mockResolvedValueOnce(duplicate)

    const result = await run(topic)

    expect(result.ok || result.issues?.join()).toMatch(/ressemble trop/)
    expect(result.ok || result.issues?.join()).toMatch(/déjà pris/)
  })

  it('raccourcit un extrait qui dépasse de peu, et prévient le relecteur', async () => {
    const long = 'Profondeur, espacement et bon moment : tout pour que tes tulipes et narcisses fleurissent au printemps, sans rien laisser au hasard, même quand l’automne traîne en longueur.'
    expect(long.length).toBeGreaterThan(160)
    generateJson.mockResolvedValueOnce(article({ excerpt: long }))

    const result = await run(topic)

    expect(result.ok).toBe(true)
    const { data } = prismaMock.blogPost.create.mock.calls[0][0]
    expect(data.excerpt.length).toBeLessThanOrEqual(160)
    expect(data.excerpt).toMatch(/…$/)
    expect(data.reviewerNotes.at(-1)).toMatch(/Raccourci automatiquement.*l’extrait/)
  })

  it('dit au modèle la longueur mesurée, pas « Too big »', async () => {
    generateJson
      .mockResolvedValueOnce(article({ title: 'x'.repeat(95) }))
      .mockResolvedValueOnce(article())

    await run(topic)

    expect(generateJson.mock.calls[1][0][1].text).toContain('le titre fait 95 caractères, 80 au plus')
  })

  it('compte les jetons d\'une version refusée pour son format', async () => {
    generateJson
      .mockResolvedValueOnce(modelSays({ title: 'Trop court' }))
      .mockResolvedValueOnce(article())

    await run(topic)

    expect(prismaMock.blogPost.create.mock.calls[0][0].data.generation.usage)
      .toEqual({ inputTokens: 2000, outputTokens: 4000 })
  })

  it('traite une réponse hors format comme un échec de rédaction', async () => {
    generateJson
      .mockResolvedValueOnce(modelSays({ title: 'Trop court' }))
      .mockResolvedValueOnce({ ok: false, reason: 'Quota Gemini dépassé', cause: 'quota' })

    const result = await run(topic)

    expect(result).toMatchObject({ ok: false, stage: 'write' })
  })
})

// ─── Garde-fous ────────────────────────────────────────────────────────────

describe('garde-fous', () => {
  it('respecte le plafond de brouillons sans appeler le modèle', async () => {
    prismaMock.blogPost.count.mockResolvedValue(2)

    await expect(run()).rejects.toThrow(ServiceError)
    await expect(run()).rejects.toMatchObject({ code: 'CONFLICT' })
    expect(generateJson).not.toHaveBeenCalled()
  })

  it('ne tente pas de rédaction sans le temps d\'en finir une', async () => {
    const result = await run({ timeBudgetMs: 10_000, topic: 'Les bulbes' })

    expect(result).toMatchObject({ ok: false, stage: 'timeout' })
    expect(generateJson).not.toHaveBeenCalled()
  })
})
