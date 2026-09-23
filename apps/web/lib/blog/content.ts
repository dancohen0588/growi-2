import 'server-only'

import type { BlogPost as PrismaBlogPost, Prisma } from '@prisma/client'
import {
  BLOG_TAGS,
  blogTagSchema,
  type BlogListResponse,
  type BlogPost,
  type BlogPostStatus,
  type BlogPostSummary,
  type BlogTag,
} from '@growi/shared'

import { prisma } from '@/lib/prisma'

/**
 * Couche de lecture du blog — **seul** module qui lit les articles pour le
 * public.
 *
 * Les articles vivent en base (`blog_posts`) ; ils s'écrivent depuis l'admin
 * (`/admin/conseils`) ou par le générateur. Ce module ne sert **que** les
 * articles publiés : un brouillon ne sort jamais d'ici, ni en production ni en
 * développement — l'aperçu se fait dans l'admin.
 *
 * Il ne rend rien : il fournit des données (métadonnées + source MDX) au web,
 * et le HTML compilé à l'API v1 pour le mobile.
 *
 * Pas de cache mémoire : le contenu change sans déploiement. Ce sont les pages
 * qui mettent en cache, et la publication qui les revalide.
 */

/** Mots par minute retenus pour l'estimation du temps de lecture. */
const WORDS_PER_MINUTE = 200

const PUBLISHED: BlogPostStatus = 'PUBLISHED'

const published = (where: Prisma.BlogPostWhereInput = {}): Prisma.BlogPostWhereInput => ({
  ...where,
  status: PUBLISHED,
})

/**
 * Ordre de lecture : du plus récent au plus ancien. L'identifiant départage
 * deux articles publiés à la même milliseconde, sans quoi la pagination
 * pourrait en montrer un deux fois.
 */
const NEWEST_FIRST: Prisma.BlogPostOrderByWithRelationInput[] = [
  { publishedAt: 'desc' },
  { id: 'desc' },
]

/** Un article publié : métadonnées + corps MDX non compilé. */
export interface BlogEntry {
  summary: BlogPostSummary
  /** Source MDX — à passer au renderer. */
  source: string
  updatedAt: string
}

// ─── Conversion ────────────────────────────────────────────────────────────

function toEntry(row: PrismaBlogPost): BlogEntry {
  // Un article publié a toujours sa date ; `createdAt` ne sert que de filet si
  // une écriture à la main l'avait oubliée.
  const publishedAt = (row.publishedAt ?? row.createdAt).toISOString()

  return {
    summary: {
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt,
      coverImage: row.coverImage,
      coverImageAlt: row.coverImageAlt,
      publishedAt,
      readingTime: readingTime(row.source),
      tags: knownTags(row.tags),
      author: row.author,
    },
    source: row.source,
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * La colonne est un `text[]` libre. Un tag retiré de `BLOG_TAGS` ne doit pas
 * faire échouer la validation de toute une liste servie au mobile : on l'écarte.
 */
function knownTags(tags: string[]): BlogTag[] {
  return tags.filter((tag): tag is BlogTag => blogTagSchema.safeParse(tag).success)
}

function readingTime(source: string): number {
  const words = source.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}

// ─── API du module ─────────────────────────────────────────────────────────

export interface ListPostsParams {
  page?: number
  limit?: number
  tag?: BlogTag
}

/** Liste paginée, du plus récent au plus ancien, filtrable par tag. */
export async function listPosts(
  { page = 1, limit = 12, tag }: ListPostsParams = {},
): Promise<BlogListResponse> {
  const where = published(tag ? { tags: { has: tag } } : {})

  const total = await prisma.blogPost.count({ where })
  const pages = Math.max(1, Math.ceil(total / limit))
  // Une page hors bornes retombe sur la dernière plutôt que de rendre du vide.
  const current = Math.min(Math.max(1, page), pages)

  const rows = await prisma.blogPost.findMany({
    where,
    orderBy: NEWEST_FIRST,
    skip: (current - 1) * limit,
    take: limit,
  })

  return {
    posts: rows.map(row => toEntry(row).summary),
    pagination: {
      page: current,
      pages,
      total,
      next: current < pages ? current + 1 : null,
    },
  }
}

/**
 * Article complet, source MDX incluse — pour les pages web.
 *
 * Pas de `cache()` React ici : il n'existe que dans la version de React que
 * Next embarque, pas dans celle que chargent les tests. La page le pose.
 */
export async function getPost(slug: string): Promise<BlogEntry | null> {
  const row = await prisma.blogPost.findFirst({ where: published({ slug }) })
  return row ? toEntry(row) : null
}

/** Slugs publiés — pour `generateStaticParams`. */
export async function listSlugs(): Promise<string[]> {
  const rows = await prisma.blogPost.findMany({
    where: published(),
    orderBy: NEWEST_FIRST,
    select: { slug: true },
  })
  return rows.map(row => row.slug)
}

/** Métadonnées de tous les articles publiés — pour le sitemap. */
export async function listAllSummaries(): Promise<
  Array<{ summary: BlogPostSummary; updatedAt: string }>
> {
  const rows = await prisma.blogPost.findMany({ where: published(), orderBy: NEWEST_FIRST })
  return rows.map(row => {
    const { summary, updatedAt } = toEntry(row)
    return { summary, updatedAt }
  })
}

/** Articles partageant un tag avec celui-ci, hors lui-même. */
export async function listRelatedPosts(slug: string, limit = 3): Promise<BlogPostSummary[]> {
  const current = await getPost(slug)
  if (!current) return []

  const tags = new Set(current.summary.tags)
  if (tags.size === 0) return []

  const rows = await prisma.blogPost.findMany({
    where: published({ slug: { not: slug }, tags: { hasSome: [...tags] } }),
    orderBy: NEWEST_FIRST,
  })

  // Le nombre de tags communs ne s'exprime pas en Prisma : on trie ici, sur un
  // volume qui reste celui d'un blog.
  return rows
    .map(row => toEntry(row).summary)
    .map(summary => ({ summary, shared: summary.tags.filter(tag => tags.has(tag)).length }))
    .sort((a, b) => b.shared - a.shared
      || b.summary.publishedAt.localeCompare(a.summary.publishedAt))
    .slice(0, limit)
    .map(candidate => candidate.summary)
}

/**
 * Tags effectivement portés par au moins un article publié, dans l'ordre de
 * `BLOG_TAGS` : le filtre de la page liste ne doit pas se réordonner à chaque
 * publication.
 */
export async function listUsedTags(): Promise<BlogTag[]> {
  const rows = await prisma.blogPost.findMany({ where: published(), select: { tags: true } })
  const used = new Set(rows.flatMap(row => row.tags))
  return BLOG_TAGS.filter(tag => used.has(tag))
}

/**
 * Article avec son MDX compilé en **HTML pur** — c'est la forme servie au
 * mobile par l'API v1, qui ne sait pas exécuter du React.
 *
 * Les imports sont dynamiques pour que `react-dom/server` et le compilateur MDX
 * ne rentrent pas dans le graphe des pages, qui n'en ont pas besoin.
 */
export async function getPostAsHtml(slug: string): Promise<BlogPost | null> {
  const entry = await getPost(slug)
  if (!entry) return null

  const [{ compileMDX }, { renderToStaticMarkup }, { htmlMdxComponents }, { mdxOptions }] =
    await Promise.all([
      import('next-mdx-remote/rsc'),
      import('react-dom/server'),
      import('./mdx-components'),
      import('./mdx-options'),
    ])

  const { content } = await compileMDX({
    source: entry.source,
    components: htmlMdxComponents,
    options: { mdxOptions },
  })

  return {
    ...entry.summary,
    html: renderToStaticMarkup(content),
    updatedAt: entry.updatedAt,
  }
}
