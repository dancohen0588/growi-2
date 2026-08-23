import fs from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { blogPostSchema, blogPostSummarySchema } from '@growi/shared'

import {
  getPost,
  getPostAsHtml,
  listPosts,
  listRelatedPosts,
  listSlugs,
  listUsedTags,
} from '../blog/content'

/**
 * Ces tests lisent les **vrais** articles de `content/blog/`. C'est voulu : ce
 * qu'on veut garantir, c'est qu'un article publié passe la validation du
 * frontmatter et compile — pas qu'une fixture inventée le fasse.
 */

describe('liste des articles', () => {
  it('lit les articles du dossier content/blog', () => {
    const { posts, pagination } = listPosts()

    expect(posts.length).toBeGreaterThan(0)
    expect(pagination.total).toBe(posts.length)
  })

  it('chaque article satisfait le contrat de l\'API', () => {
    for (const post of listPosts().posts) {
      const result = blogPostSummarySchema.safeParse(post)
      expect(result.success, `${post.slug} : ${result.error?.message}`).toBe(true)
    }
  })

  it('trie du plus récent au plus ancien', () => {
    const dates = listPosts().posts.map(p => p.publishedAt)
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('pagine et annonce la page suivante', () => {
    const first = listPosts({ limit: 1 })

    expect(first.posts).toHaveLength(1)
    expect(first.pagination.pages).toBe(first.pagination.total)
    expect(first.pagination.next).toBe(first.pagination.total > 1 ? 2 : null)
  })

  it('ramène une page hors bornes sur la dernière plutôt que de rendre du vide', () => {
    const result = listPosts({ page: 99 })

    expect(result.pagination.page).toBe(result.pagination.pages)
    expect(result.posts.length).toBeGreaterThan(0)
  })

  it('filtre par tag', () => {
    const tag = listUsedTags()[0]
    const { posts, pagination } = listPosts({ tag })

    expect(posts.length).toBeGreaterThan(0)
    expect(pagination.total).toBe(posts.length)
    expect(posts.every(p => p.tags.includes(tag))).toBe(true)
  })

  it('calcule un temps de lecture plausible', () => {
    for (const post of listPosts().posts) {
      expect(post.readingTime).toBeGreaterThanOrEqual(1)
      expect(post.readingTime).toBeLessThan(30)
    }
  })
})

describe('article isolé', () => {
  it('retourne la source MDX et les métadonnées', () => {
    const slug = listSlugs()[0]
    const entry = getPost(slug)

    expect(entry).not.toBeNull()
    expect(entry!.summary.slug).toBe(slug)
    expect(entry!.source.length).toBeGreaterThan(0)
    // Le frontmatter est consommé par gray-matter, pas laissé dans le corps.
    expect(entry!.source.trimStart().startsWith('---')).toBe(false)
  })

  it('retourne null sur un slug inconnu', () => {
    expect(getPost('article-qui-n-existe-pas')).toBeNull()
  })

  it('propose des articles liés par tag, sans se citer lui-même', () => {
    const slug = listSlugs()[0]
    const related = listRelatedPosts(slug)

    expect(related.every(p => p.slug !== slug)).toBe(true)
    expect(related.length).toBeLessThanOrEqual(3)
  })
})

describe('compilation en HTML pour le mobile', () => {
  it('compile le MDX, ancres et composants custom compris', async () => {
    const slug = listSlugs()[0]
    const post = await getPostAsHtml(slug)

    expect(post).not.toBeNull()
    expect(blogPostSchema.safeParse(post).success).toBe(true)

    // rehype-slug + autolink : chaque intertitre porte une ancre.
    expect(post!.html).toMatch(/<h2 id="/)
    // Le Callout des articles est rendu en HTML, pas laissé en JSX brut.
    expect(post!.html).not.toContain('<Callout')
    expect(post!.html).toContain('<aside')
  })

  it('retourne null sur un slug inconnu', async () => {
    expect(await getPostAsHtml('article-qui-n-existe-pas')).toBeNull()
  })
})

describe('brouillons', () => {
  const SLUG = 'fixture-brouillon-de-test'
  const file = path.join(process.cwd(), 'content', 'blog', `${SLUG}.mdx`)

  beforeAll(() => {
    fs.writeFileSync(
      file,
      [
        '---',
        'title: "Brouillon de test"',
        'excerpt: "Ne doit jamais sortir en production."',
        'publishedAt: "2026-08-24"',
        'tags: [entretien]',
        'draft: true',
        '---',
        '',
        'Contenu de test.',
        '',
      ].join('\n'),
    )
  })

  afterAll(() => {
    fs.rmSync(file, { force: true })
    vi.unstubAllEnvs()
  })

  it('est visible en développement, pour pouvoir se relire', () => {
    expect(listSlugs()).toContain(SLUG)
  })

  it('disparaît complètement en production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.resetModules()

    // `NODE_ENV` est lu au chargement du module : il faut le réimporter.
    const prod = await import('../blog/content')

    expect(prod.listSlugs()).not.toContain(SLUG)
    expect(prod.getPost(SLUG)).toBeNull()
    expect(prod.listPosts().posts.some(p => p.slug === SLUG)).toBe(false)
  })
})
