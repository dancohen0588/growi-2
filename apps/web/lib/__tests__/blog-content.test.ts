import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BlogPost as PrismaBlogPost } from '@prisma/client'
import { blogPostSchema, blogPostSummarySchema } from '@growi/shared'

/**
 * La couche de lecture tourne ici sur une doublure en mémoire de
 * `prisma.blogPost`, qui comprend les seuls filtres dont le module se sert.
 * Ce qu'on garantit : le contrat des schémas partagés, le tri, la pagination,
 * et surtout qu'un article non publié ne sort jamais.
 */

type Row = PrismaBlogPost

type Where = {
  status?: string
  slug?: string | { not: string }
  tags?: { has: string } | { hasSome: string[] }
}

const rows: Row[] = []

function matches(row: Row, where: Where = {}): boolean {
  if (where.status && row.status !== where.status) return false
  if (typeof where.slug === 'string' && row.slug !== where.slug) return false
  if (typeof where.slug === 'object' && row.slug === where.slug.not) return false
  if (where.tags && 'has' in where.tags && !row.tags.includes(where.tags.has)) return false
  if (where.tags && 'hasSome' in where.tags) {
    const wanted = where.tags.hasSome
    if (!row.tags.some(tag => wanted.includes(tag))) return false
  }
  return true
}

/** Tri `publishedAt desc, id desc` — le seul ordre que le module demande. */
function newestFirst(a: Row, b: Row): number {
  const byDate = (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
  return byDate || b.id.localeCompare(a.id)
}

const prismaMock = vi.hoisted(() => ({
  blogPost: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
  },
}))
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))

const {
  getPost,
  getPostAsHtml,
  listAllSummaries,
  listPosts,
  listRelatedPosts,
  listSlugs,
  listUsedTags,
} = await import('../blog/content')

// ─── Fixtures ──────────────────────────────────────────────────────────────

const SOURCE = [
  'Septembre est le bon mois pour préparer ton potager.',
  '',
  '## Semer les engrais verts',
  '',
  'Sème la phacélie avant le 15 octobre.',
  '',
  '<Callout tone="conseil">Arrose juste après le semis.</Callout>',
  '',
  '## Récolter les dernières tomates',
  '',
  ...Array.from({ length: 60 }, () => 'Du texte pour allonger la lecture de cet article.'),
].join('\n')

let sequence = 0

function row(overrides: Partial<Row>): Row {
  sequence += 1
  const publishedAt = overrides.publishedAt ?? new Date('2026-09-01T08:00:00Z')
  return {
    id: `post_${String(sequence).padStart(3, '0')}`,
    slug: `article-${sequence}`,
    title: `Article ${sequence}`,
    excerpt: 'Un extrait assez long pour une carte.',
    source: SOURCE,
    coverImage: 'https://ref.supabase.co/storage/v1/object/public/blog-covers/a/cover.jpg',
    coverImageAlt: 'Un potager en fin d\'été',
    coverStatus: 'READY',
    coverPrompt: null,
    tags: ['potager'],
    author: 'Growi',
    status: 'PUBLISHED',
    origin: 'manual',
    topicRationale: null,
    reviewerNotes: null,
    generation: null,
    publishedAt,
    pushRequestedAt: null,
    pushSentAt: null,
    publishedById: null,
    createdAt: publishedAt,
    updatedAt: publishedAt,
    ...overrides,
  }
}

beforeEach(() => {
  sequence = 0
  rows.length = 0
  rows.push(
    row({ slug: 'preparer-son-potager', tags: ['potager', 'saison'], publishedAt: new Date('2026-09-01T08:00:00Z') }),
    row({ slug: 'reconnaitre-l-oidium', tags: ['maladies'], publishedAt: new Date('2026-09-10T08:00:00Z') }),
    row({ slug: 'rentrer-ses-plantes', tags: ['saison', 'entretien'], publishedAt: new Date('2026-09-15T08:00:00Z') }),
    row({ slug: 'brouillon-en-relecture', tags: ['potager'], status: 'DRAFT', publishedAt: null }),
    row({ slug: 'article-depublie', tags: ['potager'], status: 'ARCHIVED', publishedAt: new Date('2026-09-20T08:00:00Z') }),
  )

  prismaMock.blogPost.count.mockImplementation(async ({ where }: { where: Where }) =>
    rows.filter(r => matches(r, where)).length)

  prismaMock.blogPost.findMany.mockImplementation(
    async ({ where, skip = 0, take }: { where: Where; skip?: number; take?: number }) => {
      const found = rows.filter(r => matches(r, where)).sort(newestFirst)
      return found.slice(skip, take === undefined ? undefined : skip + take)
    },
  )

  prismaMock.blogPost.findFirst.mockImplementation(async ({ where }: { where: Where }) =>
    rows.find(r => matches(r, where)) ?? null)
})

// ─── Liste ─────────────────────────────────────────────────────────────────

describe('liste des articles', () => {
  it('ne sert que les articles publiés', async () => {
    const { posts, pagination } = await listPosts()

    expect(posts.map(p => p.slug)).toEqual([
      'rentrer-ses-plantes',
      'reconnaitre-l-oidium',
      'preparer-son-potager',
    ])
    expect(pagination.total).toBe(3)
  })

  it('chaque article satisfait le contrat de l\'API', async () => {
    for (const post of (await listPosts()).posts) {
      const result = blogPostSummarySchema.safeParse(post)
      expect(result.success, `${post.slug} : ${result.error?.message}`).toBe(true)
    }
  })

  it('pagine et annonce la page suivante', async () => {
    const first = await listPosts({ limit: 1 })

    expect(first.posts).toHaveLength(1)
    expect(first.pagination).toEqual({ page: 1, pages: 3, total: 3, next: 2 })
  })

  it('ramène une page hors bornes sur la dernière plutôt que de rendre du vide', async () => {
    const result = await listPosts({ page: 99, limit: 2 })

    expect(result.pagination.page).toBe(2)
    expect(result.posts.map(p => p.slug)).toEqual(['preparer-son-potager'])
  })

  it('filtre par tag', async () => {
    const { posts, pagination } = await listPosts({ tag: 'saison' })

    expect(posts.map(p => p.slug)).toEqual(['rentrer-ses-plantes', 'preparer-son-potager'])
    expect(pagination.total).toBe(2)
  })

  it('calcule un temps de lecture plausible', async () => {
    for (const post of (await listPosts()).posts) {
      expect(post.readingTime).toBeGreaterThanOrEqual(1)
      expect(post.readingTime).toBeLessThan(30)
    }
  })

  it('écarte un tag inconnu plutôt que de casser toute la liste', async () => {
    rows[0].tags = ['potager', 'tag-retire']

    const post = (await listPosts()).posts.find(p => p.slug === 'preparer-son-potager')

    expect(post?.tags).toEqual(['potager'])
    expect(blogPostSummarySchema.safeParse(post).success).toBe(true)
  })

  it('liste les tags utilisés dans l\'ordre de BLOG_TAGS, brouillons exclus', async () => {
    rows.find(r => r.status === 'DRAFT')!.tags = ['actus-growi']

    expect(await listUsedTags()).toEqual(['saison', 'potager', 'entretien', 'maladies'])
  })

  it('le sitemap et les chemins prérendus ne voient que les articles publiés', async () => {
    expect(await listSlugs()).toEqual([
      'rentrer-ses-plantes',
      'reconnaitre-l-oidium',
      'preparer-son-potager',
    ])
    expect((await listAllSummaries()).map(s => s.summary.slug)).toHaveLength(3)
  })
})

// ─── Article isolé ─────────────────────────────────────────────────────────

describe('article isolé', () => {
  it('retourne la source MDX et les métadonnées', async () => {
    const entry = await getPost('reconnaitre-l-oidium')

    expect(entry?.summary.slug).toBe('reconnaitre-l-oidium')
    expect(entry?.summary.publishedAt).toBe('2026-09-10T08:00:00.000Z')
    expect(entry?.source).toBe(SOURCE)
  })

  it('retourne null sur un slug inconnu, un brouillon ou un article dépublié', async () => {
    expect(await getPost('article-qui-n-existe-pas')).toBeNull()
    expect(await getPost('brouillon-en-relecture')).toBeNull()
    expect(await getPost('article-depublie')).toBeNull()
  })

  it('propose des articles liés par tag, sans se citer lui-même ni un brouillon', async () => {
    const related = await listRelatedPosts('preparer-son-potager')

    expect(related.map(p => p.slug)).toEqual(['rentrer-ses-plantes'])
  })
})

// ─── HTML pour le mobile ───────────────────────────────────────────────────

describe('compilation en HTML pour le mobile', () => {
  it('compile le MDX, ancres et composants custom compris', async () => {
    const post = await getPostAsHtml('preparer-son-potager')

    expect(post).not.toBeNull()
    expect(blogPostSchema.safeParse(post).success).toBe(true)

    // rehype-slug + autolink : chaque intertitre porte une ancre.
    expect(post!.html).toMatch(/<h2 id="/)
    // Le Callout est rendu en HTML, pas laissé en JSX brut.
    expect(post!.html).not.toContain('<Callout')
    expect(post!.html).toContain('<aside')
  })

  it('retourne null sur un slug inconnu ou un brouillon', async () => {
    expect(await getPostAsHtml('article-qui-n-existe-pas')).toBeNull()
    expect(await getPostAsHtml('brouillon-en-relecture')).toBeNull()
  })
})
