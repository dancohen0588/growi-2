'use server'

/**
 * Server Actions du portail d'administration, volet « Conseils » (blog).
 *
 * Même discipline que `messages.ts` : `requireAdmin()` à chaque entrée — le
 * layout ne protège pas une action —, validation, délégation au service,
 * journalisation, revalidation. Aucune écriture Prisma ici.
 */

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { blogCadenceSchema } from '@growi/shared'

import { logAdminAction } from '@/lib/admin/audit'
import { requireAdmin } from '@/lib/admin/auth'
import { MAX_TOPIC_LENGTH } from '@/lib/blog/editorial'
import {
  blogPostEditSchema,
  deleteBlogPost,
  getPostForAdmin,
  publishBlogPost,
  setCadence,
  unpublishBlogPost,
  updateBlogPost,
} from '@/lib/services/blog-admin.service'
import { generateCover } from '@/lib/services/blog-cover.service'
import { generateArticle } from '@/lib/services/blog-generator.service'
import { isServiceError, ServiceError } from '@/lib/services/errors'

export type ActionResult = { ok: true; message: string } | { ok: false; error: string }

/** Sous les 60 s de Vercel : la page déclare `maxDuration = 60`. */
const ACTION_BUDGET_MS = 55_000

async function run(fn: () => Promise<string>): Promise<ActionResult> {
  try {
    return { ok: true, message: await fn() }
  } catch (err) {
    if (isServiceError(err)) return { ok: false, error: err.message }
    console.error('[admin] action conseils en échec', err)
    return { ok: false, error: 'Une erreur est survenue. Réessaie dans un instant.' }
  }
}

/** L'admin : la liste, la fiche, le badge de la nav, le journal. */
function revalidateAdmin(id?: string) {
  revalidatePath('/admin/conseils')
  if (id) revalidatePath(`/admin/conseils/${id}`)
  revalidatePath('/admin/journal')
  revalidatePath('/admin', 'layout')
}

/**
 * Le public : la liste, l'article, le sitemap, **et l'accueil** — il liste
 * trois articles et vit en ISR de 24 h, il montrerait sinon un article
 * dépublié jusqu'au lendemain.
 */
function revalidatePublic(slug: string) {
  revalidatePath('/blog')
  revalidatePath(`/blog/${slug}`)
  revalidatePath('/sitemap.xml')
  revalidatePath('/')
}

// ─── Génération ────────────────────────────────────────────────────────────

const topicSchema = z.string().trim().max(MAX_TOPIC_LENGTH, `Sujet trop long (${MAX_TOPIC_LENGTH} caractères au plus).`)

/**
 * « Générer un article ». Tourne dans la requête de la page (jusqu'à 60 s) et,
 * en cas de succès, ouvre la fiche du brouillon.
 */
export async function generateArticleAction(formData: FormData): Promise<ActionResult> {
  let createdId: string | null = null

  const result = await run(async () => {
    const admin = await requireAdmin()

    const parsed = topicSchema.safeParse(formData.get('topic') ?? '')
    if (!parsed.success) throw new ServiceError('INVALID_INPUT', parsed.error.issues[0].message)

    const generated = await generateArticle({
      origin: 'admin',
      actorId: admin.id,
      topic: parsed.data || undefined,
      timeBudgetMs: ACTION_BUDGET_MS,
    })

    if (!generated.ok) {
      const details = generated.issues?.length ? ` ${generated.issues.slice(0, 3).join(' ')}` : ''
      throw new ServiceError('UNAVAILABLE', `${generated.reason}${details}`)
    }

    await logAdminAction({
      actorId: admin.id,
      action: 'blog.generate',
      targetType: 'blog_post',
      targetId: generated.post.id,
      details: {
        slug: generated.post.slug,
        sujetImpose: Boolean(parsed.data),
        couverture: generated.cover?.ok ?? false,
      },
    })

    revalidateAdmin(generated.post.id)
    createdId = generated.post.id
    return 'Brouillon créé.'
  })

  // Hors de `run` : `redirect` lève une exception de contrôle que `run`
  // prendrait pour une erreur.
  if (createdId) redirect(`/admin/conseils/${createdId}`)
  return result
}

// ─── Édition ───────────────────────────────────────────────────────────────

export async function updateBlogPostAction(id: string, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()

    const optional = (name: string) => {
      const value = formData.get(name)
      return value === null ? undefined : String(value)
    }
    const parsed = blogPostEditSchema.safeParse({
      title: formData.get('title'),
      excerpt: formData.get('excerpt'),
      tags: formData.getAll('tags'),
      source: formData.get('source'),
      coverImageAlt: optional('coverImageAlt'),
      coverPrompt: optional('coverPrompt'),
    })
    if (!parsed.success) throw new ServiceError('INVALID_INPUT', parsed.error.issues[0].message)

    const { post, warnings } = await updateBlogPost(admin.id, id, parsed.data)

    revalidateAdmin(id)
    // Corriger une coquille sur un article publié doit se voir tout de suite.
    if (post.status === 'PUBLISHED') revalidatePublic(post.slug)

    return warnings.length > 0
      ? `Enregistré. À surveiller : ${warnings.join(' ')}`
      : 'Enregistré.'
  })
}

// ─── Cycle de vie ──────────────────────────────────────────────────────────

export async function publishBlogPostAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()
    const post = await publishBlogPost(admin.id, id)

    revalidateAdmin(id)
    revalidatePublic(post.slug)
    return 'Article publié. L’app mobile le verra dans l’heure.'
  })
}

export async function unpublishBlogPostAction(id: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()
    const post = await unpublishBlogPost(admin.id, id)

    revalidateAdmin(id)
    revalidatePublic(post.slug)
    return 'Article dépublié : il n’est plus visible sur le site.'
  })
}

export async function deleteBlogPostAction(id: string): Promise<ActionResult> {
  let deleted = false

  const result = await run(async () => {
    const admin = await requireAdmin()
    await deleteBlogPost(admin.id, id)
    revalidateAdmin()
    deleted = true
    return 'Article supprimé.'
  })

  if (deleted) redirect('/admin/conseils')
  return result
}

// ─── Couverture ────────────────────────────────────────────────────────────

const coverPromptSchema = z.string().trim().max(2000)

/**
 * « Régénérer l'image », avec le prompt éventuellement ajusté. Un échec n'est
 * pas une erreur de l'action : la couverture reste à produire, et le message
 * dit pourquoi.
 */
export async function regenerateCoverAction(id: string, formData: FormData): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()
    const post = await getPostForAdmin(id)

    const prompt = coverPromptSchema.safeParse(formData.get('coverPrompt') ?? '')
    if (!prompt.success) throw new ServiceError('INVALID_INPUT', 'Prompt trop long (2 000 caractères au plus).')

    const cover = await generateCover(id, { prompt: prompt.data || undefined, budgetMs: ACTION_BUDGET_MS })

    await logAdminAction({
      actorId: admin.id,
      action: 'blog.regenerate_cover',
      targetType: 'blog_post',
      targetId: id,
      details: { reussi: cover.ok, promptModifie: Boolean(prompt.data) },
    })

    revalidateAdmin(id)
    if (post.status === 'PUBLISHED') revalidatePublic(post.slug)

    if (!cover.ok) throw new ServiceError('UNAVAILABLE', `Image non produite : ${cover.reason}`)
    return 'Nouvelle couverture en place.'
  })
}

// ─── Réglages ──────────────────────────────────────────────────────────────

export async function setCadenceAction(cadence: string): Promise<ActionResult> {
  return run(async () => {
    const admin = await requireAdmin()

    const parsed = blogCadenceSchema.safeParse(cadence)
    if (!parsed.success) throw new ServiceError('INVALID_INPUT', 'Cadence inconnue.')

    await setCadence(admin.id, parsed.data)
    revalidateAdmin()
    return 'Cadence enregistrée. Le prochain passage du lundi en tiendra compte.'
  })
}
