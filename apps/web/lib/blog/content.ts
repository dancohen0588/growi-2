import 'server-only'

import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import {
  BLOG_TAGS,
  blogFrontmatterSchema,
  type BlogListResponse,
  type BlogPost,
  type BlogPostSummary,
  type BlogTag,
} from '@growi/shared'

/**
 * Couche de lecture du blog — **seul** module qui touche aux fichiers MDX.
 *
 * Les articles vivent dans `apps/web/content/blog/*.mdx`, un fichier par
 * article nommé par son slug. Publier = ajouter un fichier et pousser.
 *
 * Ce module ne rend rien : il fournit des données (métadonnées + source MDX) au
 * web, et le HTML compilé à l'API v1 pour le mobile. C'est le seul fichier à
 * réécrire si le contenu déménageait un jour vers un CMS.
 */

const CONTENT_DIR = path.join(process.cwd(), 'content', 'blog')

/** Mots par minute retenus pour l'estimation du temps de lecture. */
const WORDS_PER_MINUTE = 200

const IS_PRODUCTION = process.env.NODE_ENV === 'production'

/** Un article tel que lu sur le disque : métadonnées + corps MDX non compilé. */
export interface BlogEntry {
  summary: BlogPostSummary
  /** Source MDX, sans le frontmatter — à passer au renderer. */
  source: string
  updatedAt: string
  draft: boolean
}

/**
 * Cache module-level : parser une fois par process suffit, les fichiers ne
 * changent qu'au déploiement. Désactivé hors production pour que l'édition
 * d'un article se voie sans redémarrer le serveur de dev.
 */
let cache: BlogEntry[] | null = null

// ─── Lecture ───────────────────────────────────────────────────────────────

function readEntries(): BlogEntry[] {
  if (cache) return cache

  const files = fs.existsSync(CONTENT_DIR)
    ? fs.readdirSync(CONTENT_DIR).filter(f => f.endsWith('.mdx'))
    : []

  const entries = files
    .map(file => parseEntry(file))
    .sort((a, b) => b.summary.publishedAt.localeCompare(a.summary.publishedAt))

  if (IS_PRODUCTION) cache = entries
  return entries
}

function parseEntry(file: string): BlogEntry {
  const slug = file.replace(/\.mdx$/, '')
  const raw = fs.readFileSync(path.join(CONTENT_DIR, file), 'utf8')
  const { data, content } = matter(raw)

  const parsed = blogFrontmatterSchema.safeParse(data)
  if (!parsed.success) {
    // Citer le fichier fautif : sans ça, l'erreur de build est indéchiffrable.
    const details = parsed.error.issues
      .map(issue => `  - ${issue.path.join('.') || '(racine)'} : ${issue.message}`)
      .join('\n')
    throw new Error(`Frontmatter invalide dans content/blog/${file} :\n${details}`)
  }

  const front = parsed.data
  const publishedAt = toIsoDate(front.publishedAt, file, 'publishedAt')

  return {
    summary: {
      slug,
      title: front.title,
      excerpt: front.excerpt,
      coverImage: front.coverImage,
      coverImageAlt: front.coverImageAlt,
      publishedAt,
      readingTime: readingTime(content),
      tags: front.tags,
      author: front.author,
    },
    source: content,
    updatedAt: front.updatedAt ? toIsoDate(front.updatedAt, file, 'updatedAt') : publishedAt,
    draft: front.draft,
  }
}

/**
 * Le frontmatter porte des dates en `YYYY-MM-DD` ; YAML désérialise celles qui
 * ne sont pas quotées en objet `Date`. Les schémas d'entité, eux, veulent de
 * l'ISO complet.
 */
function toIsoDate(value: string | Date, file: string, field: string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Date invalide dans content/blog/${file} : ${field} = ${String(value)}`)
  }
  return date.toISOString()
}

function readingTime(source: string): number {
  const words = source.trim().split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.ceil(words / WORDS_PER_MINUTE))
}

/** Les brouillons ne sont visibles qu'en développement. */
function visibleEntries(): BlogEntry[] {
  return readEntries().filter(entry => !IS_PRODUCTION || !entry.draft)
}

// ─── API du module ─────────────────────────────────────────────────────────

export interface ListPostsParams {
  page?: number
  limit?: number
  tag?: BlogTag
}

/** Liste paginée, du plus récent au plus ancien, filtrable par tag. */
export function listPosts({ page = 1, limit = 12, tag }: ListPostsParams = {}): BlogListResponse {
  const matching = visibleEntries().filter(entry => !tag || entry.summary.tags.includes(tag))

  const total = matching.length
  const pages = Math.max(1, Math.ceil(total / limit))
  const current = Math.min(Math.max(1, page), pages)
  const start = (current - 1) * limit

  return {
    posts: matching.slice(start, start + limit).map(entry => entry.summary),
    pagination: {
      page: current,
      pages,
      total,
      next: current < pages ? current + 1 : null,
    },
  }
}

/** Article complet, source MDX incluse — pour les pages web. */
export function getPost(slug: string): BlogEntry | null {
  return visibleEntries().find(entry => entry.summary.slug === slug) ?? null
}

/** Slugs visibles — pour `generateStaticParams` et le sitemap. */
export function listSlugs(): string[] {
  return visibleEntries().map(entry => entry.summary.slug)
}

/** Métadonnées de tous les articles visibles — pour le sitemap. */
export function listAllSummaries(): Array<{ summary: BlogPostSummary; updatedAt: string }> {
  return visibleEntries().map(({ summary, updatedAt }) => ({ summary, updatedAt }))
}

/** Articles partageant un tag avec celui-ci, hors lui-même. */
export function listRelatedPosts(slug: string, limit = 3): BlogPostSummary[] {
  const current = getPost(slug)
  if (!current) return []

  const tags = new Set(current.summary.tags)

  return visibleEntries()
    .filter(entry => entry.summary.slug !== slug)
    .map(entry => ({
      summary: entry.summary,
      shared: entry.summary.tags.filter(tag => tags.has(tag)).length,
    }))
    .filter(candidate => candidate.shared > 0)
    .sort((a, b) => b.shared - a.shared
      || b.summary.publishedAt.localeCompare(a.summary.publishedAt))
    .slice(0, limit)
    .map(candidate => candidate.summary)
}

/**
 * Tags effectivement portés par au moins un article visible, dans l'ordre de
 * `BLOG_TAGS` : le filtre de la page liste ne doit pas se réordonner à chaque
 * publication.
 */
export function listUsedTags(): BlogTag[] {
  const used = new Set<BlogTag>()
  for (const entry of visibleEntries()) {
    for (const tag of entry.summary.tags) used.add(tag)
  }
  return BLOG_TAGS.filter(tag => used.has(tag))
}

/**
 * Article avec son MDX compilé en **HTML pur** — c'est la forme servie au
 * mobile par l'API v1 (phase 3), qui ne sait pas exécuter du React.
 *
 * Les imports sont dynamiques pour que `react-dom/server` et le compilateur MDX
 * ne rentrent pas dans le graphe des pages, qui n'en ont pas besoin.
 */
export async function getPostAsHtml(slug: string): Promise<BlogPost | null> {
  const entry = getPost(slug)
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

/** Vide le cache — utile aux tests, qui écrivent des fixtures à la volée. */
export function clearBlogCache(): void {
  cache = null
}
