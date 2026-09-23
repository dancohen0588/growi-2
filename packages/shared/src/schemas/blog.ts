/**
 * Blog Growi — « Conseils & actus jardin ».
 *
 * Les articles vivent en base (`blog_posts`), leur corps en MDX. Ces schémas
 * décrivent la représentation **JSON** qu'en sert l'API v1 au mobile (dates en
 * chaînes ISO), et servent aussi de contrat au module de lecture côté web.
 *
 * Deux vues :
 * - `blogPostSummarySchema` — la liste, sans le corps de l'article ;
 * - `blogPostSchema` — le détail, avec le MDX compilé en HTML.
 */

import { z } from 'zod'
import { isoDateTimeSchema } from './common'

// ─── Tags ──────────────────────────────────────────────────────────────────

/** Tags autorisés sur un article. */
export const BLOG_TAGS = ['saison', 'potager', 'entretien', 'maladies', 'actus-growi'] as const
export const blogTagSchema = z.enum(BLOG_TAGS)
export type BlogTag = z.infer<typeof blogTagSchema>

export const BLOG_TAG_LABELS: Record<BlogTag, string> = {
  saison: 'Au fil des saisons',
  potager: 'Potager',
  entretien: 'Entretien',
  maladies: 'Maladies & nuisibles',
  'actus-growi': 'Actus Growi',
}

// ─── Cycle de vie d'un article ─────────────────────────────────────────────

/**
 * Seul `PUBLISHED` est servi au public. `ARCHIVED` est un article dépublié :
 * son URL rend 404, mais il reste relisible et republiable depuis l'admin.
 */
export const BLOG_POST_STATUSES = ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const
export const blogPostStatusSchema = z.enum(BLOG_POST_STATUSES)
export type BlogPostStatus = z.infer<typeof blogPostStatusSchema>

/** `PENDING` : à générer, faute de temps ou après un échec. L'article reste valide. */
export const BLOG_COVER_STATUSES = ['NONE', 'PENDING', 'READY'] as const
export const blogCoverStatusSchema = z.enum(BLOG_COVER_STATUSES)
export type BlogCoverStatus = z.infer<typeof blogCoverStatusSchema>

/** D'où vient l'article : écrit à la main, généré depuis l'admin, ou par le cron. */
export const BLOG_POST_ORIGINS = ['manual', 'admin', 'cron'] as const
export const blogPostOriginSchema = z.enum(BLOG_POST_ORIGINS)
export type BlogPostOrigin = z.infer<typeof blogPostOriginSchema>

/** Rythme de la génération automatique, réglé depuis l'admin. */
export const BLOG_CADENCES = ['weekly', 'biweekly', 'monthly'] as const
export const blogCadenceSchema = z.enum(BLOG_CADENCES)
export type BlogCadence = z.infer<typeof blogCadenceSchema>

/**
 * Au-delà, la génération s'arrête : l'automatisation ne doit pas empiler des
 * brouillons que personne ne relit.
 */
export const MAX_PENDING_DRAFTS = 2

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)

/**
 * Sortie attendue du modèle de rédaction, validée avant tout enregistrement.
 * `reviewerNotes` n'est jamais publié : c'est la liste de ce qu'un relecteur
 * doit vérifier (chiffres, dates, doses, affirmations botaniques).
 */
export const generatedArticleSchema = z.object({
  title: z.string().min(20).max(80),
  slug: slugSchema,
  excerpt: z.string().min(60).max(160),
  tags: z.array(blogTagSchema).min(1).max(2),
  mdx: z.string().min(3000),
  coverPrompt: z.string().min(80),
  coverImageAlt: z.string().min(20).max(200),
  reviewerNotes: z.array(z.string()).min(1).max(15),
})

export type GeneratedArticle = z.infer<typeof generatedArticleSchema>

// ─── Entités servies par l'API ─────────────────────────────────────────────

/** Vue liste : pas de HTML, assez léger pour un carrousel mobile. */
export const blogPostSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  excerpt: z.string(),
  /** URL complète (Supabase Storage), ou `null` : la carte affiche alors un dégradé. */
  coverImage: z.string().nullable(),
  coverImageAlt: z.string().nullable(),
  publishedAt: isoDateTimeSchema,
  /** Temps de lecture en minutes, calculé à la lecture de l'article. */
  readingTime: z.number().int(),
  tags: z.array(blogTagSchema),
  author: z.string(),
})

/** Vue détail : + le contenu compilé en HTML (consommé par le mobile). */
export const blogPostSchema = blogPostSummarySchema.extend({
  html: z.string(),
  updatedAt: isoDateTimeSchema,
})

export const blogPaginationSchema = z.object({
  page: z.number().int(),
  pages: z.number().int(),
  total: z.number().int(),
  /** Numéro de la page suivante, `null` sur la dernière. */
  next: z.number().int().nullable(),
})

export const blogListResponseSchema = z.object({
  posts: z.array(blogPostSummarySchema),
  pagination: blogPaginationSchema,
})

export type BlogPostSummary = z.infer<typeof blogPostSummarySchema>
export type BlogPost = z.infer<typeof blogPostSchema>
export type BlogPagination = z.infer<typeof blogPaginationSchema>
export type BlogListResponse = z.infer<typeof blogListResponseSchema>

// ─── Requête de liste ──────────────────────────────────────────────────────

/** Query string de `GET /api/v1/blog` et des liens `?tag=&page=` du web. */
export const blogListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  tag: blogTagSchema.optional(),
})

export type BlogListQuery = z.infer<typeof blogListQuerySchema>
