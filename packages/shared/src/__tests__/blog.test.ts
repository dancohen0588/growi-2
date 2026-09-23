import { describe, expect, it } from 'vitest'

import {
  BLOG_CADENCES,
  BLOG_POST_STATUSES,
  BLOG_TAGS,
  MAX_PENDING_DRAFTS,
  blogPostStatusSchema,
  generatedArticleSchema,
  BLOG_TAG_LABELS,
  blogFrontmatterSchema,
  blogListQuerySchema,
  blogListResponseSchema,
  blogPostSchema,
  blogPostSummarySchema,
} from '../index'

/** Frontmatter minimal d'un article, tel que `gray-matter` le rend. */
const frontmatter = {
  title: 'Préparer son potager en septembre',
  excerpt: "Semis d'automne, engrais verts, derniers arrosages : la check-list du mois.",
  publishedAt: '2026-09-01',
  tags: ['potager', 'saison'],
}

const summary = {
  slug: 'preparer-son-potager-en-septembre',
  title: frontmatter.title,
  excerpt: frontmatter.excerpt,
  coverImage: '/blog/preparer-son-potager-en-septembre/cover.jpg',
  coverImageAlt: 'Potager en fin d\'été',
  publishedAt: '2026-09-01T00:00:00.000Z',
  readingTime: 5,
  tags: ['potager', 'saison'],
  author: 'Dan',
}

describe('frontmatter d\'un article', () => {
  it('accepte le frontmatter minimal et comble les champs facultatifs', () => {
    const parsed = blogFrontmatterSchema.parse(frontmatter)

    expect(parsed.author).toBe('Growi')
    expect(parsed.draft).toBe(false)
    expect(parsed.coverImage).toBeNull()
    expect(parsed.coverImageAlt).toBeNull()
    expect(parsed.updatedAt).toBeUndefined()
  })

  it('accepte une date YAML non quotée, que gray-matter rend en objet Date', () => {
    const parsed = blogFrontmatterSchema.parse({
      ...frontmatter,
      publishedAt: new Date('2026-09-01'),
    })

    expect(parsed.publishedAt).toBeInstanceOf(Date)
  })

  it('rejette un tag hors de la liste autorisée', () => {
    const result = blogFrontmatterSchema.safeParse({ ...frontmatter, tags: ['jardinage'] })

    expect(result.success).toBe(false)
  })

  it('exige au moins un tag, un titre et un extrait', () => {
    expect(blogFrontmatterSchema.safeParse({ ...frontmatter, tags: [] }).success).toBe(false)
    expect(blogFrontmatterSchema.safeParse({ ...frontmatter, title: '' }).success).toBe(false)
    expect(blogFrontmatterSchema.safeParse({ ...frontmatter, excerpt: '' }).success).toBe(false)
  })

  it('chaque tag autorisé a un libellé d\'affichage', () => {
    for (const tag of BLOG_TAGS) {
      expect(BLOG_TAG_LABELS[tag]).toBeTruthy()
    }
  })
})

describe('entités servies par l\'API', () => {
  it('valide un résumé d\'article', () => {
    expect(blogPostSummarySchema.safeParse(summary).success).toBe(true)
  })

  it('accepte une couverture absente', () => {
    const result = blogPostSummarySchema.safeParse({
      ...summary,
      coverImage: null,
      coverImageAlt: null,
    })

    expect(result.success).toBe(true)
  })

  it('exige des dates ISO complètes, pas le YYYY-MM-DD du frontmatter', () => {
    expect(blogPostSummarySchema.safeParse({ ...summary, publishedAt: '2026-09-01' }).success)
      .toBe(false)
  })

  it('le détail ajoute le HTML compilé et la date de mise à jour', () => {
    const detail = { ...summary, html: '<p>Bonjour</p>', updatedAt: '2026-09-02T00:00:00.000Z' }

    expect(blogPostSchema.safeParse(detail).success).toBe(true)
    expect(blogPostSchema.safeParse(summary).success).toBe(false)
  })

  it('valide une réponse de liste paginée', () => {
    const response = {
      posts: [summary],
      pagination: { page: 1, pages: 1, total: 1, next: null },
    }

    expect(blogListResponseSchema.safeParse(response).success).toBe(true)
  })
})

describe('article généré', () => {
  const generated = {
    title: 'Pailler ses massifs avant l\'hiver',
    slug: 'pailler-ses-massifs-avant-l-hiver',
    excerpt: 'Quel paillage, quelle épaisseur, et à quel moment le poser pour protéger les racines du gel.',
    tags: ['entretien', 'saison'],
    mdx: 'Du texte. '.repeat(400),
    coverPrompt: 'A flower bed mulched with straw along an old stone wall in a French garden, low morning light.',
    coverImageAlt: 'Massif paillé de paille le long d\'un muret en pierre',
    reviewerNotes: ['Épaisseur de 5 à 10 cm'],
  }

  it('accepte une sortie conforme', () => {
    expect(generatedArticleSchema.safeParse(generated).success).toBe(true)
  })

  it('refuse un slug qui ne serait pas une URL propre', () => {
    for (const slug of ['Pailler', 'pailler--massifs', 'pailler_massifs', '-pailler']) {
      expect(generatedArticleSchema.safeParse({ ...generated, slug }).success).toBe(false)
    }
  })

  it('refuse un article trop court, trop de tags, ou sans notes pour le relecteur', () => {
    expect(generatedArticleSchema.safeParse({ ...generated, mdx: 'Trop court.' }).success).toBe(false)
    expect(generatedArticleSchema.safeParse({ ...generated, tags: ['entretien', 'saison', 'potager'] }).success)
      .toBe(false)
    expect(generatedArticleSchema.safeParse({ ...generated, reviewerNotes: [] }).success).toBe(false)
  })

  it('refuse un extrait trop long pour une méta-description', () => {
    expect(generatedArticleSchema.safeParse({ ...generated, excerpt: 'x'.repeat(161) }).success)
      .toBe(false)
  })

  it('expose les statuts et cadences attendus par la base et l\'admin', () => {
    expect(BLOG_POST_STATUSES).toEqual(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
    expect(blogPostStatusSchema.safeParse('draft').success).toBe(false)
    expect(BLOG_CADENCES).toEqual(['weekly', 'biweekly', 'monthly'])
    expect(MAX_PENDING_DRAFTS).toBe(2)
  })
})

describe('query de liste', () => {
  it('applique les valeurs par défaut', () => {
    expect(blogListQuerySchema.parse({})).toEqual({ page: 1, limit: 12 })
  })

  it('convertit les paramètres d\'URL, qui sont des chaînes', () => {
    expect(blogListQuerySchema.parse({ page: '3', limit: '5', tag: 'potager' }))
      .toEqual({ page: 3, limit: 5, tag: 'potager' })
  })

  it('refuse une page nulle ou une limite hors bornes', () => {
    expect(blogListQuerySchema.safeParse({ page: '0' }).success).toBe(false)
    expect(blogListQuerySchema.safeParse({ limit: '500' }).success).toBe(false)
  })
})
