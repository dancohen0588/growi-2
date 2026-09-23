/**
 * Couverture d'un article du blog : prompt → `gemini-2.5-flash-image` (16:9)
 * → `toCoverJpeg` → bucket `blog-covers` → `coverStatus = READY`.
 *
 * **L'image ne bloque jamais l'article.** Rien ici ne lève : un échec (clé
 * absente, modèle saturé, délai dépassé, stockage indisponible) laisse la
 * couverture en `PENDING`, et un passage suivant du cron — ou le bouton de
 * l'admin — la produira. L'article reste publiable avec son dégradé.
 *
 * Seul module à importer `@google/genai` : l'autre SDK Gemini du projet
 * (`@google/generative-ai`, dans `gemini.ts`) ne sait pas rendre d'image.
 */

import { GoogleGenAI } from '@google/genai'
import * as Sentry from '@sentry/nextjs'
import type { Prisma } from '@prisma/client'
import type { BlogCoverStatus } from '@growi/shared'

import { toCoverJpeg } from '@/lib/blog/cover-image'
import { ensureCoverClosing } from '@/lib/blog/editorial'
import { prisma } from '@/lib/prisma'
import { deleteCoverByUrl, uploadCover } from '@/lib/storage'

const LOG = '[blog-cover]'

export const COVER_IMAGE_MODEL = 'gemini-2.5-flash-image'

/** Une image prend 10 à 20 s : en dessous, on ne la tente pas. */
export const MIN_COVER_BUDGET_MS = 20_000

/** Délai laissé au recadrage, au dépôt et à l'écriture une fois l'image reçue. */
const AFTER_IMAGE_MS = 4_000

export type CoverResult =
  | { ok: true; url: string; imageMs: number }
  | { ok: false; reason: string }

export interface GenerateCoverOptions {
  /** Prompt ajusté depuis l'admin ; sinon celui conservé sur l'article. */
  prompt?: string
  /** Temps disponible pour tout le passage, image comprise. */
  budgetMs?: number
}

/**
 * Produit la couverture d'un article et l'enregistre. En cas de succès,
 * l'ancienne couverture du bucket est supprimée — après, jamais avant.
 */
export async function generateCover(
  postId: string,
  options: GenerateCoverOptions = {},
): Promise<CoverResult> {
  const startedAt = Date.now()

  try {
    const post = await prisma.blogPost.findUnique({
      where: { id: postId },
      select: { id: true, slug: true, coverImage: true, coverPrompt: true, generation: true },
    })
    if (!post) return { ok: false, reason: 'Article introuvable.' }

    const source = options.prompt?.trim() || post.coverPrompt?.trim()
    if (!source) return await markPending(postId, 'Aucun prompt de couverture.')
    const prompt = ensureCoverClosing(source)

    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return await markPending(postId, 'Clé Gemini absente.', prompt)

    const timeoutMs = (options.budgetMs ?? 60_000) - AFTER_IMAGE_MS
    if (timeoutMs < MIN_COVER_BUDGET_MS - AFTER_IMAGE_MS) {
      return await markPending(postId, 'Pas assez de temps pour produire l’image.', prompt)
    }

    const image = await requestImage(apiKey, prompt, timeoutMs)
    if (!image.ok) return await markPending(postId, image.reason, prompt)
    const imageMs = Date.now() - startedAt

    const jpeg = await toCoverJpeg(image.bytes)
    const { url } = await uploadCover(post.slug, jpeg)

    await prisma.blogPost.update({
      where: { id: postId },
      data: {
        coverImage: url,
        coverStatus: 'READY' satisfies BlogCoverStatus,
        coverPrompt: prompt,
        generation: mergeTrace(post.generation, { imageModel: COVER_IMAGE_MODEL, imageMs }),
      },
    })

    // Après l'écriture : si elle avait échoué, l'article pointerait encore sur
    // l'ancienne image, qui doit donc exister.
    if (post.coverImage && post.coverImage !== url) await deleteCoverByUrl(post.coverImage)

    console.info(`${LOG} couverture de ${post.slug} prête (${imageMs} ms, ${(jpeg.byteLength / 1024) | 0} Ko)`)
    return { ok: true, url, imageMs }
  } catch (error) {
    return markPending(postId, describeError(error))
  }
}

/**
 * L'erreur du SDK porte en message tout le JSON de l'API — deux mille
 * caractères pour dire « quota dépassé ». On la résume : c'est ce que lira
 * l'administrateur, et ce qui s'affiche dans les journaux.
 */
export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error)
  let status = typeof error === 'object' && error && 'status' in error ? Number((error as { status: unknown }).status) : NaN
  if (Number.isNaN(status)) {
    try {
      status = Number((JSON.parse(message) as { error?: { code?: unknown } }).error?.code)
    } catch {
      // Pas du JSON : le message se suffit.
    }
  }

  switch (status) {
    case 429:
      return /free_tier|limit: 0/i.test(message)
        ? 'Quota Gemini image épuisé : l’offre gratuite ne couvre pas la génération d’images (facturation à activer).'
        : 'Quota Gemini image dépassé pour le moment (429).'
    case 503:
      return 'Modèle d’image momentanément surchargé (503).'
    case 400:
      return 'Prompt d’image refusé par le modèle (400).'
    case 401:
    case 403:
      return `Clé Gemini refusée pour la génération d’images (${status}).`
    default:
      return message.split('\n')[0].slice(0, 200)
  }
}

/** L'article le plus ancien dont la couverture reste à produire, s'il y en a un. */
export async function findPendingCover(excludeId?: string): Promise<{ id: string; slug: string } | null> {
  return prisma.blogPost.findFirst({
    where: {
      coverStatus: 'PENDING' satisfies BlogCoverStatus,
      coverPrompt: { not: null },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, slug: true },
  })
}

// ─── Appel au modèle ───────────────────────────────────────────────────────

type ImageResponse = { ok: true; bytes: Buffer } | { ok: false; reason: string }

async function requestImage(apiKey: string, prompt: string, timeoutMs: number): Promise<ImageResponse> {
  const client = new GoogleGenAI({ apiKey })

  return Sentry.startSpan(
    { name: 'gemini.image', op: 'ai.run', attributes: { 'gemini.model': COVER_IMAGE_MODEL } },
    async () => {
      const response = await client.models.generateContent({
        model: COVER_IMAGE_MODEL,
        contents: prompt,
        config: {
          responseModalities: ['IMAGE'],
          imageConfig: { aspectRatio: '16:9' },
          httpOptions: { timeout: timeoutMs },
        },
      })

      const parts = response.candidates?.[0]?.content?.parts ?? []
      const data = parts.find(part => part.inlineData?.data)?.inlineData?.data
      if (!data) {
        // Refus de sécurité ou réponse en texte seul : rien à recadrer.
        const finish = response.candidates?.[0]?.finishReason ?? 'inconnue'
        return { ok: false, reason: `Aucune image rendue (fin : ${finish}).` }
      }
      return { ok: true, bytes: Buffer.from(data, 'base64') }
    },
  )
}

// ─── Utilitaires ───────────────────────────────────────────────────────────

/**
 * Un échec laisse la couverture à produire. L'image existante (le dégradé,
 * ou la précédente d'une régénération ratée) reste en place : un article ne
 * perd jamais sa couverture sur un échec.
 */
async function markPending(postId: string, reason: string, prompt?: string): Promise<CoverResult> {
  console.error(`${LOG} couverture de ${postId} non produite : ${reason}`)
  Sentry.captureMessage(`${LOG} couverture non produite`, {
    level: 'warning',
    tags: { 'blog.stage': 'cover' },
    extra: { postId, reason },
  })

  try {
    await prisma.blogPost.update({
      where: { id: postId },
      data: { coverStatus: 'PENDING' satisfies BlogCoverStatus, ...(prompt ? { coverPrompt: prompt } : {}) },
    })
  } catch (error) {
    console.error(`${LOG} statut PENDING non écrit :`, error)
  }
  return { ok: false, reason }
}

function mergeTrace(current: Prisma.JsonValue | null, extra: Record<string, unknown>): Prisma.InputJsonValue {
  const base = current && typeof current === 'object' && !Array.isArray(current) ? current : {}
  return { ...base, ...extra } as Prisma.InputJsonValue
}
