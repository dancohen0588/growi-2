import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BlogListResponse, BlogPost } from '@growi/shared'

// L'origine du site est lue au chargement du module : la fixer avant tout import.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SITE_URL = 'https://growi.test'
})

// ─── Doublure de la couche de contenu ──────────────────────────────────────
//
// Les routes ne font que sérialiser : c'est `lib/blog/content.ts` qui lit les
// fichiers, et il est déjà couvert par ses propres tests sur de vrais articles.

const blogContent = vi.hoisted(() => ({
  listPosts: vi.fn(),
  getPostAsHtml: vi.fn(),
}))

vi.mock('@/lib/blog/content', () => blogContent)

const { GET: listBlog } = await import('@/app/api/v1/blog/route')
const { GET: getBlogPost } = await import('@/app/api/v1/blog/[slug]/route')

// ─── Fixtures ──────────────────────────────────────────────────────────────

const summary = {
  slug: 'preparer-son-potager-en-septembre',
  title: 'Préparer son potager en septembre',
  excerpt: 'La check-list du mois.',
  coverImage: '/blog/preparer-son-potager-en-septembre/cover.png',
  coverImageAlt: "Potager en fin d'été",
  publishedAt: '2026-08-19T00:00:00.000Z',
  readingTime: 6,
  tags: ['potager', 'saison'] as const,
  author: 'Dan',
}

const listResponse: BlogListResponse = {
  posts: [{ ...summary, tags: [...summary.tags] }],
  pagination: { page: 1, pages: 2, total: 13, next: 2 },
}

const post: BlogPost = {
  ...summary,
  tags: [...summary.tags],
  updatedAt: '2026-08-20T00:00:00.000Z',
  html: '<p>Voir <a href="/encyclopedie/tomate">la tomate</a> et <a href="#semis">plus bas</a>.</p>'
    + '<img src="/blog/preparer-son-potager-en-septembre/mulch.jpg" alt="Mulch"/>'
    + '<a href="https://open-meteo.com">Open-Meteo</a>',
}

function listRequest(query = ''): Request {
  return new Request(`http://localhost/api/v1/blog${query}`)
}

beforeEach(() => {
  vi.clearAllMocks()
  blogContent.listPosts.mockReturnValue(listResponse)
  blogContent.getPostAsHtml.mockResolvedValue(post)
})

// ─── GET /api/v1/blog ──────────────────────────────────────────────────────

describe('GET /api/v1/blog', () => {
  it('renvoie la liste dans l\'enveloppe { data }', async () => {
    const response = await listBlog(listRequest())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.data.pagination).toEqual({ page: 1, pages: 2, total: 13, next: 2 })
    expect(body.data.posts).toHaveLength(1)
  })

  it('rend les couvertures absolues — le mobile n\'a pas de page de référence', async () => {
    const body = await (await listBlog(listRequest())).json()

    expect(body.data.posts[0].coverImage)
      .toBe('https://growi.test/blog/preparer-son-potager-en-septembre/cover.png')
  })

  it('transmet pagination et filtre, avec les valeurs par défaut', async () => {
    await listBlog(listRequest('?page=2&limit=5&tag=potager'))
    expect(blogContent.listPosts).toHaveBeenCalledWith({ page: 2, limit: 5, tag: 'potager' })

    await listBlog(listRequest())
    expect(blogContent.listPosts).toHaveBeenLastCalledWith({ page: 1, limit: 12 })
  })

  it('rejette un tag inconnu ou une pagination absurde', async () => {
    for (const query of ['?tag=jardinage', '?page=0', '?limit=999']) {
      const response = await listBlog(listRequest(query))
      expect(response.status, query).toBe(400)
      expect((await response.json()).error.code).toBe('INVALID_INPUT')
    }
  })

  it('se laisse mettre en cache : le contenu est le même pour tout le monde', async () => {
    const response = await listBlog(listRequest())

    expect(response.headers.get('cache-control'))
      .toBe('public, s-maxage=3600, stale-while-revalidate=86400')
  })
})

// ─── GET /api/v1/blog/[slug] ───────────────────────────────────────────────

describe('GET /api/v1/blog/[slug]', () => {
  const context = { params: { slug: summary.slug } }

  it('renvoie l\'article avec son HTML compilé', async () => {
    const response = await getBlogPost(new Request('http://localhost'), context)
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(blogContent.getPostAsHtml).toHaveBeenCalledWith(summary.slug)
    expect(body.data.slug).toBe(summary.slug)
    expect(body.data.updatedAt).toBe('2026-08-20T00:00:00.000Z')
  })

  it('absolutise les images et les liens internes du HTML', async () => {
    const { html } = (await (await getBlogPost(new Request('http://localhost'), context)).json()).data

    expect(html).toContain('src="https://growi.test/blog/preparer-son-potager-en-septembre/mulch.jpg"')
    expect(html).toContain('href="https://growi.test/encyclopedie/tomate"')
  })

  it('laisse intacts les ancres et les liens déjà absolus', async () => {
    const { html } = (await (await getBlogPost(new Request('http://localhost'), context)).json()).data

    expect(html).toContain('href="#semis"')
    expect(html).toContain('href="https://open-meteo.com"')
  })

  it('répond 404 sur un slug inconnu', async () => {
    blogContent.getPostAsHtml.mockResolvedValue(null)

    const response = await getBlogPost(
      new Request('http://localhost'),
      { params: { slug: 'article-inexistant' } },
    )

    expect(response.status).toBe(404)
    expect((await response.json()).error).toEqual({
      code: 'NOT_FOUND',
      message: 'Article introuvable',
    })
  })

  it('se laisse mettre en cache', async () => {
    const response = await getBlogPost(new Request('http://localhost'), context)

    expect(response.headers.get('cache-control'))
      .toBe('public, s-maxage=3600, stale-while-revalidate=86400')
  })
})
