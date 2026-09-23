/**
 * Écritures de l'admin sur les articles du blog (`/admin/conseils`).
 *
 * Toutes passent par `auditWrite` : l'écriture et sa trace dans le journal
 * vivent ou meurent ensemble. Les lectures sont celles de l'admin, qui voit
 * tous les statuts — à ne pas confondre avec `lib/blog/content.ts`, qui ne
 * sert que les articles publiés au public.
 *
 * Aucune connaissance de Next ici : la revalidation des pages est faite par
 * les Server Actions, qui savent quels chemins un changement affecte.
 */

import type { BlogPost, Prisma } from '@prisma/client'
import { z } from 'zod'
import {
  blogCadenceSchema,
  blogTagSchema,
  type BlogCadence,
  type BlogPostStatus,
} from '@growi/shared'

import { auditWrite } from '@/lib/admin/audit'
import { compileArticleMdx } from '@/lib/blog/compile'
import {
  blockingIssues,
  ensureCoverClosing,
  forbiddenTermsIn,
  lintArticle,
  type LintIssue,
} from '@/lib/blog/editorial'
import { prisma } from '@/lib/prisma'
import { SETTING_KEYS } from '@/lib/services/app-settings.service'
import { ServiceError } from '@/lib/services/errors'
import { deleteCoverByUrl } from '@/lib/storage'

// ─── Lectures ──────────────────────────────────────────────────────────────

/** Ce que montre une ligne de la liste : pas le corps, qui pèse. */
const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  tags: true,
  status: true,
  origin: true,
  coverImage: true,
  coverStatus: true,
  createdAt: true,
  publishedAt: true,
  updatedAt: true,
} as const satisfies Prisma.BlogPostSelect

export type BlogAdminRow = Prisma.BlogPostGetPayload<{ select: typeof LIST_SELECT }>

/**
 * Articles d'un statut. Un blog compte des dizaines d'articles, pas des
 * milliers : pas de pagination, les plus récents d'abord.
 */
export async function listByStatus(status: BlogPostStatus): Promise<BlogAdminRow[]> {
  return prisma.blogPost.findMany({
    where: { status },
    orderBy: status === 'PUBLISHED'
      ? [{ publishedAt: 'desc' }, { id: 'desc' }]
      : [{ updatedAt: 'desc' }, { id: 'desc' }],
    select: LIST_SELECT,
  })
}

/** Nombre d'articles par statut — les compteurs des onglets et le badge de la nav. */
export async function countByStatus(): Promise<Record<BlogPostStatus, number>> {
  const groups = await prisma.blogPost.groupBy({ by: ['status'], _count: { _all: true } })
  const counts: Record<BlogPostStatus, number> = { DRAFT: 0, PUBLISHED: 0, ARCHIVED: 0 }
  for (const group of groups) {
    if (group.status in counts) counts[group.status as BlogPostStatus] = group._count._all
  }
  return counts
}

/** @throws ServiceError('NOT_FOUND') */
export async function getPostForAdmin(id: string): Promise<BlogPost> {
  const post = await prisma.blogPost.findUnique({ where: { id } })
  if (!post) throw new ServiceError('NOT_FOUND', 'Article introuvable.')
  return post
}

// ─── Édition ───────────────────────────────────────────────────────────────

/**
 * Champs éditables à la main. Le slug n'y est pas : figé à la publication, il
 * ne change pas non plus avant — un brouillon relu garde celui qu'il a reçu.
 */
export const blogPostEditSchema = z.object({
  title: z.string().trim().min(10, 'Titre trop court.').max(100, 'Titre trop long (100 caractères au plus).'),
  excerpt: z.string().trim().min(20, 'Extrait trop court.').max(160, 'L’extrait sert de méta-description : 160 caractères au plus.'),
  tags: z.array(blogTagSchema).min(1, 'Choisis au moins un tag.').max(2, 'Deux tags au plus.'),
  source: z.string().trim().min(1, 'Le corps de l’article est vide.'),
  coverImageAlt: z.string().trim().max(200).optional(),
  coverPrompt: z.string().trim().max(2000).optional(),
})

export type BlogPostEdit = z.infer<typeof blogPostEditSchema>

export interface UpdateResult {
  post: BlogPost
  /** Défauts non bloquants — la longueur, les termes vagues : l'admin a le dernier mot. */
  warnings: string[]
}

/**
 * Enregistre une édition. Mêmes contrôles qu'à la génération (§ 5.4), sauf la
 * longueur, qui n'est plus qu'un avertissement.
 *
 * @throws ServiceError('INVALID_INPUT') avec la liste des défauts bloquants.
 */
export async function updateBlogPost(actorId: string, id: string, input: BlogPostEdit): Promise<UpdateResult> {
  const before = await getPostForAdmin(id)

  const issues = await articleIssues(
    { title: input.title, excerpt: input.excerpt, mdx: input.source },
    { lengthAsWarning: true },
  )
  const blocking = blockingIssues(issues)
  if (blocking.length > 0) {
    throw new ServiceError('INVALID_INPUT', blocking.map(issue => issue.message).join(' '))
  }

  // Un navigateur envoie un textarea en fins de ligne Windows : sans cette
  // normalisation, la moindre retouche du titre réécrivait tout le corps.
  const source = `${input.source.replace(/\r\n?/g, '\n').trimEnd()}\n`

  const data: Prisma.BlogPostUpdateInput = {
    title: input.title,
    excerpt: input.excerpt,
    tags: keepTagOrder(before.tags, input.tags),
    source,
    ...(input.coverImageAlt !== undefined ? { coverImageAlt: input.coverImageAlt || null } : {}),
    ...(input.coverPrompt !== undefined
      ? { coverPrompt: input.coverPrompt ? ensureCoverClosing(input.coverPrompt) : null }
      : {}),
  }

  const comparable = (value: unknown) => (typeof value === 'string' ? value.trimEnd() : JSON.stringify(value))
  const changed = (['title', 'excerpt', 'tags', 'source', 'coverImageAlt', 'coverPrompt'] as const).filter(field => {
    const next = data[field]
    return next !== undefined && comparable(next) !== comparable(before[field])
  })

  const post = await auditWrite(
    tx => tx.blogPost.update({ where: { id }, data }),
    // Les noms des champs, pas leur contenu : le corps d'un article n'a rien à
    // faire dans un journal qui s'exporte, et l'article garde sa version.
    { actorId, action: 'blog.update', targetType: 'blog_post', targetId: id, details: { champs: changed } },
  )

  return { post, warnings: issues.filter(issue => issue.severity === 'warning').map(issue => issue.message) }
}

/**
 * Garde l'ordre des tags déjà posés, et range les nouveaux après. Les cases à
 * cocher suivent l'ordre de `BLOG_TAGS` ; les reprendre telles quelles
 * changeait le **premier tag**, qui sert d'étiquette sur la carte publique, à
 * chaque correction de titre.
 */
export function keepTagOrder(current: readonly string[], chosen: readonly string[]): string[] {
  const kept = current.filter(tag => chosen.includes(tag))
  return [...kept, ...chosen.filter(tag => !kept.includes(tag))]
}

// ─── Cycle de vie ──────────────────────────────────────────────────────────

/**
 * DRAFT ou ARCHIVED → PUBLISHED.
 *
 * Deux conditions seulement, celles de la spec : le MDX compile, et rien ne
 * trahit le procédé de rédaction. Le reste du lint (longueur, tutoiement…) a
 * déjà joué à la génération et à l'édition ; l'imposer ici rendrait
 * impubliable un article importé, écrit avant ces règles.
 *
 * `publishedAt` n'est posé qu'à la première publication : republier un article
 * dépublié ne le fait pas remonter en tête du blog.
 *
 * `notify` (case « Prévenir les utilisateurs », cochée par défaut) demande
 * l'annonce push du lendemain matin — **à la première publication seulement**.
 * Republier un article déjà annoncé, ou corrigé, ne notifie personne.
 */
export async function publishBlogPost(
  actorId: string,
  id: string,
  options: { notify?: boolean } = {},
): Promise<BlogPost> {
  const post = await getPostForAdmin(id)
  if (post.status === 'PUBLISHED') throw new ServiceError('CONFLICT', 'Cet article est déjà publié.')

  const compiled = await compileArticleMdx(post.source)
  if (!compiled.ok) {
    throw new ServiceError('INVALID_INPUT', `Publication impossible : le corps ne compile pas (${compiled.error}).`)
  }
  const forbidden = forbiddenTermsIn(`${post.title}\n${post.excerpt}\n${post.source}`)
  if (forbidden.length > 0) {
    throw new ServiceError('INVALID_INPUT', `Publication impossible : termes interdits (${forbidden.join(', ')}).`)
  }

  const firstTime = !post.publishedAt
  const announce = firstTime && (options.notify ?? true)
  return auditWrite(
    tx => tx.blogPost.update({
      where: { id },
      data: {
        status: 'PUBLISHED' satisfies BlogPostStatus,
        publishedById: actorId,
        ...(firstTime ? { publishedAt: new Date() } : {}),
        ...(announce ? { pushRequestedAt: new Date() } : {}),
      },
    }),
    {
      actorId,
      action: 'blog.publish',
      targetType: 'blog_post',
      targetId: id,
      details: { slug: post.slug, depuis: post.status, premiere: firstTime, annonce: announce },
    },
  )
}

/** PUBLISHED → ARCHIVED : l'article disparaît du site et de l'API, son URL rend 404. */
export async function unpublishBlogPost(actorId: string, id: string): Promise<BlogPost> {
  const post = await getPostForAdmin(id)
  if (post.status !== 'PUBLISHED') throw new ServiceError('CONFLICT', 'Cet article n’est pas publié.')

  return auditWrite(
    tx => tx.blogPost.update({ where: { id }, data: { status: 'ARCHIVED' satisfies BlogPostStatus } }),
    { actorId, action: 'blog.unpublish', targetType: 'blog_post', targetId: id, details: { slug: post.slug } },
  )
}

/**
 * Suppression physique, couverture comprise. Jamais un article publié : le
 * dépublier d'abord oblige à passer par l'état où il ne se voit plus, et
 * laisse une trace de chaque étape.
 */
export async function deleteBlogPost(actorId: string, id: string): Promise<{ slug: string }> {
  const post = await getPostForAdmin(id)
  if (post.status === 'PUBLISHED') {
    throw new ServiceError('CONFLICT', 'Un article publié ne se supprime pas : dépublie-le d’abord.')
  }

  await auditWrite(
    tx => tx.blogPost.delete({ where: { id } }),
    {
      actorId,
      action: 'blog.delete',
      targetType: 'blog_post',
      targetId: id,
      // Le titre survit ainsi à l'article : sans lui, la ligne du journal ne
      // dirait plus ce qui a été supprimé.
      details: { slug: post.slug, titre: post.title, statut: post.status },
    },
  )

  // Après la suppression : si elle avait échoué, l'article pointerait encore
  // sur son image. Ne lève jamais.
  await deleteCoverByUrl(post.coverImage)
  return { slug: post.slug }
}

// ─── Réglages ──────────────────────────────────────────────────────────────

export async function setCadence(actorId: string, cadence: BlogCadence): Promise<void> {
  const value = blogCadenceSchema.parse(cadence)
  await auditWrite(
    tx => tx.appSetting.upsert({
      where: { key: SETTING_KEYS.blogCadence },
      create: { key: SETTING_KEYS.blogCadence, value },
      update: { value },
    }),
    { actorId, action: 'blog.cadence', targetType: 'app_setting', targetId: SETTING_KEYS.blogCadence, details: { cadence: value } },
  )
}

// ─── Contrôles ─────────────────────────────────────────────────────────────

/**
 * Lint d'`editorial.ts` + compilation réelle. Rendu pour l'édition, et pour
 * l'encart d'avertissements de la fiche.
 */
export async function articleIssues(
  article: { title: string; excerpt: string; mdx: string },
  options: { lengthAsWarning?: boolean } = {},
): Promise<LintIssue[]> {
  const issues = lintArticle(article, options)
  const compiled = await compileArticleMdx(article.mdx)
  if (!compiled.ok) {
    issues.unshift({ code: 'compile_error', message: `Le corps ne compile pas : ${compiled.error}`, severity: 'error' })
  }
  return issues
}
