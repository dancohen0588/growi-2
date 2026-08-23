/**
 * Blog Growi — « Conseils & actus jardin ».
 *
 * Le contenu vit en fichiers MDX dans `apps/web/content/blog/`. Ces schémas
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

/** Tags autorisés dans le frontmatter d'un article. */
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

// ─── Frontmatter ───────────────────────────────────────────────────────────

/**
 * Frontmatter YAML d'un fichier `.mdx`, tel qu'écrit par l'auteur.
 *
 * Les dates y sont en `YYYY-MM-DD` (plus lisible à la rédaction) ; la couche de
 * lecture les convertit en ISO complet pour les schémas d'entité ci-dessous.
 * `js-yaml` désérialise une date non quotée en objet `Date` : on accepte les
 * deux formes plutôt que d'imposer des guillemets à la rédaction.
 */
export const blogFrontmatterSchema = z.object({
  title: z.string().min(1),
  excerpt: z.string().min(1),
  coverImage: z.string().min(1).nullable().default(null),
  coverImageAlt: z.string().min(1).nullable().default(null),
  publishedAt: z.union([z.string(), z.date()]),
  updatedAt: z.union([z.string(), z.date()]).optional(),
  tags: z.array(blogTagSchema).min(1),
  author: z.string().min(1).default('Growi'),
  draft: z.boolean().default(false),
})

export type BlogFrontmatter = z.infer<typeof blogFrontmatterSchema>

// ─── Entités servies par l'API ─────────────────────────────────────────────

/** Vue liste : pas de HTML, assez léger pour un carrousel mobile. */
export const blogPostSummarySchema = z.object({
  slug: z.string(),
  title: z.string(),
  excerpt: z.string(),
  /** Chemin absolu (`/blog/…`) côté web ; l'API v1 le préfixe en URL complète. */
  coverImage: z.string().nullable(),
  coverImageAlt: z.string().nullable(),
  publishedAt: isoDateTimeSchema,
  /** Temps de lecture en minutes, calculé à la lecture du fichier. */
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
