/**
 * Génération d'un article du blog « Conseils » : thème → rédaction → contrôles
 * → brouillon.
 *
 * Le service **n'écrit qu'un brouillon**. Rien n'est publié sans qu'un
 * administrateur le relise : l'article arrive avec ses « notes pour le
 * relecteur », la liste des chiffres et affirmations à vérifier.
 *
 * Ce qui est acceptable (ton, interdits, saisons, seuils) est décidé par
 * `lib/blog/editorial.ts` ; ce module orchestre les appels, les reprises et
 * l'écriture. Le texte est enregistré dès qu'il est validé ; la couverture
 * n'est tentée qu'ensuite, s'il reste assez de temps — l'image ne bloque
 * jamais le texte. Les administrateurs sont enfin prévenus par email.
 *
 * Un échec de génération n'est pas une exception : c'est un résultat
 * `{ ok: false }` que le cron journalise et que l'admin affiche. Seuls lèvent
 * le plafond de brouillons et une clé API absente — des préconditions.
 */

import * as Sentry from '@sentry/nextjs'
import type { BlogPost } from '@prisma/client'
import { z } from 'zod'
import {
  generatedArticleSchema,
  MAX_PENDING_DRAFTS,
  type BlogPostOrigin,
  type BlogPostStatus,
  type GeneratedArticle,
} from '@growi/shared'

import { compileArticleMdx } from '@/lib/blog/compile'
import {
  ARTICLE_SYSTEM_PROMPT,
  AUTO_TAGS,
  blockingIssues,
  buildArticlePrompt,
  buildTopicPrompt,
  ensureCoverClosing,
  findSimilarTitle,
  lintArticle,
  sanitizeTopic,
  type InventoryItem,
  type TopicCandidate,
} from '@/lib/blog/editorial'
import { prisma } from '@/lib/prisma'
import { generateCover, MIN_COVER_BUDGET_MS, type CoverResult } from '@/lib/services/blog-cover.service'
import { addresses, escapeHtml, getResendClient } from '@/lib/services/contact.service'
import { ServiceError } from '@/lib/services/errors'
import { SITE_URL } from '@/lib/site-url'
import { generateJson, requireGeminiKey, stripFence, type GeminiUsage } from '@/lib/services/gemini'

const LOG = '[blog-generator]'

/** Un article de 1200 mots en JSON, échappements et notes compris, avec de la marge. */
const ARTICLE_MAX_TOKENS = 8192
const TOPIC_MAX_TOKENS = 1500

/** Assez de variété pour écrire, pas assez pour dériver. */
const ARTICLE_TEMPERATURE = 0.7
const TOPIC_TEMPERATURE = 0.4

/** Une rédaction prend 15 à 25 s : en dessous, on ne la tente pas. */
export const MIN_WRITE_BUDGET_MS = 25_000

/** Une première rédaction, puis une seule reprise avec la liste des défauts. */
const MAX_WRITE_ATTEMPTS = 2

// ─── Types ─────────────────────────────────────────────────────────────────

export interface GenerateArticleInput {
  origin: BlogPostOrigin
  /** Administrateur à l'origine d'une génération depuis l'admin. */
  actorId?: string
  /** Sujet imposé (admin) : saute le choix de thème. Tronqué à 200 caractères. */
  topic?: string
  /** Temps disponible, compté depuis l'appel — 55 s sous le plafond Vercel. */
  timeBudgetMs: number
  /** Injectable pour les tests. */
  now?: () => Date
}

export type GenerationStage = 'topic' | 'write' | 'check' | 'timeout'

export type GenerateArticleResult =
  | {
    ok: true
    post: BlogPost
    attempts: number
    /** `null` : pas assez de temps pour l'essayer, la couverture reste à produire. */
    cover: CoverResult | null
    /** Temps restant sur le budget, pour un éventuel rattrapage de couverture. */
    remainingMs: number
  }
  | {
    ok: false
    stage: GenerationStage
    reason: string
    /** Défauts de la dernière version refusée, s'il y en a eu une. */
    issues?: string[]
  }

/** Trace conservée sur l'article (`BlogPost.generation`). */
interface GenerationTrace {
  topicModel?: string
  topicMs?: number
  textModel: string
  textMs: number
  attempts: number
  usage: { inputTokens: number; outputTokens: number }
  /** Défauts de chaque version refusée, pour régler les prompts. */
  rejected: string[][]
  requestedBy?: string
}

// ─── Point d'entrée ────────────────────────────────────────────────────────

/**
 * @throws ServiceError('CONFLICT') si le plafond de brouillons est atteint,
 * ServiceError('UNAVAILABLE') si la clé Gemini manque.
 */
export async function generateArticle(input: GenerateArticleInput): Promise<GenerateArticleResult> {
  const startedAt = Date.now()
  const deadline = startedAt + input.timeBudgetMs
  const today = (input.now ?? (() => new Date()))()

  const apiKey = requireGeminiKey('Génération d’articles indisponible (clé API manquante).')

  const drafts = await countPendingDrafts()
  if (drafts >= MAX_PENDING_DRAFTS) {
    throw new ServiceError(
      'CONFLICT',
      `${drafts} brouillons attendent déjà une relecture : publie-les ou supprime-les avant d'en générer un autre.`,
    )
  }

  const existing = await prisma.blogPost.findMany({
    select: { title: true, slug: true, tags: true, status: true, publishedAt: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  })
  const inventory: InventoryItem[] = existing.map(post => ({
    title: post.title,
    tags: post.tags,
    status: post.status,
    date: post.publishedAt ?? post.createdAt,
  }))
  const existingTitles = existing.map(post => post.title)

  const usage = { inputTokens: 0, outputTokens: 0 }
  const trace: Partial<GenerationTrace> = { rejected: [], requestedBy: input.actorId }

  // 1. Thème
  let topic: TopicCandidate
  const imposed = input.topic ? sanitizeTopic(input.topic) : ''
  if (imposed) {
    topic = {
      title: imposed,
      angle: imposed,
      tags: [],
      why: 'Sujet demandé depuis l’administration.',
    }
  } else {
    const topicStartedAt = Date.now()
    const picked = await pickTopic({ apiKey, today, inventory, existingTitles })
    trace.topicMs = Date.now() - topicStartedAt
    if (!picked.ok) return fail(input, 'topic', picked.reason, startedAt)
    topic = picked.topic
    trace.topicModel = picked.model
    addUsage(usage, picked.usage)
  }

  // 2 et 3. Rédaction, contrôles, une reprise
  let previousIssues: string[] | undefined
  let accepted: { article: GeneratedArticle; model: string } | null = null
  let textMs = 0
  let attempts = 0
  let lastFailure: 'write' | 'check' = 'check'

  while (attempts < MAX_WRITE_ATTEMPTS) {
    if (deadline - Date.now() < MIN_WRITE_BUDGET_MS) {
      return fail(input, 'timeout', 'Plus assez de temps pour rédiger l’article.', startedAt, previousIssues)
    }

    attempts += 1
    const writeStartedAt = Date.now()
    const written = await writeArticle({ apiKey, today, topic, previousIssues })
    textMs += Date.now() - writeStartedAt
    addUsage(usage, written.usage)

    if (!written.ok) {
      // Un modèle saturé ou une réponse illisible : la reprise a sa chance.
      previousIssues = [written.reason]
      trace.rejected!.push(previousIssues)
      lastFailure = 'write'
      console.warn(`${LOG} version ${attempts} inexploitable : ${written.reason}`)
      continue
    }

    const issues = await checkArticle(written.article, { existingTitles })
    if (issues.length === 0) {
      accepted = { article: written.article, model: written.model }
      break
    }

    previousIssues = issues
    trace.rejected!.push(issues)
    lastFailure = 'check'
    console.warn(`${LOG} version ${attempts} refusée :`, issues.join(' | '))
  }

  if (!accepted) {
    const reason = lastFailure === 'write'
      ? 'Le modèle n’a pas rendu d’article exploitable.'
      : 'L’article généré ne passe pas les contrôles.'
    return fail(input, lastFailure, reason, startedAt, previousIssues)
  }

  // 4. Brouillon
  const { article, model } = accepted
  const generation: GenerationTrace = {
    ...trace,
    textModel: model,
    textMs,
    attempts,
    usage,
    rejected: trace.rejected ?? [],
  }

  const post = await prisma.blogPost.create({
    data: {
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      source: article.mdx.trim() + '\n',
      tags: article.tags,
      coverStatus: 'PENDING',
      coverPrompt: ensureCoverClosing(article.coverPrompt),
      coverImageAlt: article.coverImageAlt,
      status: 'DRAFT' satisfies BlogPostStatus,
      origin: input.origin,
      topicRationale: topic.why,
      reviewerNotes: article.reviewerNotes,
      generation: JSON.parse(JSON.stringify(generation)),
    },
  })

  console.info(
    `${LOG} brouillon ${post.slug} (origine ${input.origin}, ${attempts} rédaction(s), ${Date.now() - startedAt} ms)`,
  )

  // 5. Couverture, seulement s'il reste de quoi la finir
  let cover: CoverResult | null = null
  let saved = post
  const remaining = deadline - Date.now()
  if (remaining >= MIN_COVER_BUDGET_MS) {
    cover = await generateCover(post.id, { budgetMs: remaining })
    if (cover.ok) saved = (await prisma.blogPost.findUnique({ where: { id: post.id } })) ?? post
  } else {
    console.info(`${LOG} couverture de ${post.slug} remise à plus tard (${remaining} ms restantes)`)
  }

  // 6. Prévenir les relecteurs
  await notifyAdminsOfDraft(saved, { excludeUserId: input.actorId })

  return { ok: true, post: saved, attempts, cover, remainingMs: deadline - Date.now() }
}

/**
 * Email « un brouillon attend ta relecture » à tous les administrateurs
 * actifs, sauf celui qui vient de le demander depuis l'admin — il l'a sous les
 * yeux. Un seul email par article ; ne lève jamais : sans Resend, le badge de
 * l'admin reste le rappel.
 */
export async function notifyAdminsOfDraft(
  post: Pick<BlogPost, 'id' | 'title' | 'excerpt' | 'topicRationale'>,
  options: { excludeUserId?: string } = {},
): Promise<{ sent: number }> {
  try {
    const resend = getResendClient()
    if (!resend) return { sent: 0 }

    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        disabledAt: null,
        ...(options.excludeUserId ? { id: { not: options.excludeUserId } } : {}),
      },
      select: { email: true },
    })
    if (admins.length === 0) return { sent: 0 }

    const link = `${SITE_URL}/admin/conseils/${post.id}`
    const why = post.topicRationale
      ? `<p style="color:#555"><em>Pourquoi ce thème : ${escapeHtml(post.topicRationale)}</em></p>`
      : ''

    await resend.emails.send({
      from: addresses().from,
      to: admins.map(admin => admin.email),
      subject: `Un nouveau conseil attend ta relecture : ${post.title}`,
      html: `<p><strong>${escapeHtml(post.title)}</strong></p>
             <p>${escapeHtml(post.excerpt)}</p>
             ${why}
             <p>Vérifie les chiffres listés dans « À vérifier avant publication », puis publie ou corrige.</p>
             <p><a href="${link}">Relire le brouillon</a></p>`,
    })
    return { sent: admins.length }
  } catch (error) {
    console.error(`${LOG} email aux administrateurs non envoyé :`, error)
    return { sent: 0 }
  }
}

// ─── Article écrit à la main ───────────────────────────────────────────────

export type ManualDraftResult =
  | { ok: true; post: BlogPost | null; warnings: string[] }
  | { ok: false; issues: string[] }

/**
 * Enregistre en brouillon un article **écrit à la main** (skill Claude Code
 * `growi-blog-article`), au format `generatedArticleSchema`.
 *
 * Mêmes contrôles qu'une génération — schéma, slug libre, titre qui ne double
 * rien, compilation, lint — parce qu'un article manuel se relit et se publie
 * par le même chemin. Deux différences assumées : `actus-growi` est permis
 * (c'est le seul chemin qui le produit), et le plafond de brouillons n'empêche
 * rien, il avertit — c'est l'automatisation qu'il arrête, pas une personne.
 *
 * `dryRun` contrôle sans écrire : `post` vaut alors `null`.
 */
export async function createManualDraft(
  input: unknown,
  options: { dryRun?: boolean } = {},
): Promise<ManualDraftResult> {
  const parsed = generatedArticleSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, issues: parsed.error.issues.map(issue => describeIssue(issue, input)) }
  }
  const article = parsed.data

  const existing = await prisma.blogPost.findMany({ select: { title: true } })
  const issues = await checkArticle(article, { existingTitles: existing.map(post => post.title) })
  if (issues.length > 0) return { ok: false, issues }

  const warnings = lintArticle(article)
    .filter(issue => issue.severity === 'warning')
    .map(issue => issue.message)

  const drafts = await countPendingDrafts()
  if (drafts >= MAX_PENDING_DRAFTS) {
    warnings.push(`${drafts} brouillons attendent déjà : la génération automatique restera à l’arrêt tant qu’ils sont là.`)
  }

  if (options.dryRun) return { ok: true, post: null, warnings }

  const post = await prisma.blogPost.create({
    data: {
      slug: article.slug,
      title: article.title,
      excerpt: article.excerpt,
      source: article.mdx.trim() + '\n',
      tags: article.tags,
      coverStatus: 'PENDING',
      coverPrompt: ensureCoverClosing(article.coverPrompt),
      coverImageAlt: article.coverImageAlt,
      status: 'DRAFT' satisfies BlogPostStatus,
      origin: 'manual' satisfies BlogPostOrigin,
      reviewerNotes: article.reviewerNotes,
    },
  })
  console.info(`${LOG} brouillon manuel ${post.slug}`)
  return { ok: true, post, warnings }
}

export async function countPendingDrafts(): Promise<number> {
  return prisma.blogPost.count({ where: { status: 'DRAFT' satisfies BlogPostStatus } })
}

// ─── Étape 1 : thème ───────────────────────────────────────────────────────

const topicResponseSchema = z.object({
  candidates: z
    .array(z.object({
      title: z.string().min(1),
      tags: z.array(z.string()),
      angle: z.string().min(1),
      why: z.string().min(1),
    }))
    .min(1),
})

type Picked =
  | { ok: true; topic: TopicCandidate; model: string; usage?: GeminiUsage }
  | { ok: false; reason: string }

/**
 * Trois candidats classés ; on retient le premier qui ne ressemble à aucun
 * titre existant et qui porte au moins un tag choisissable automatiquement.
 */
export async function pickTopic(input: {
  apiKey: string
  today: Date
  inventory: readonly InventoryItem[]
  existingTitles: readonly string[]
}): Promise<Picked> {
  const response = await generateJson(
    [{ text: buildTopicPrompt({ today: input.today, inventory: input.inventory }) }],
    {
      apiKey: input.apiKey,
      maxOutputTokens: TOPIC_MAX_TOKENS,
      logLabel: 'blog-topic',
      temperature: TOPIC_TEMPERATURE,
    },
  )
  if (!response.ok) return { ok: false, reason: response.reason }

  const parsed = topicResponseSchema.safeParse(safeJson(response.raw))
  if (!parsed.success) return { ok: false, reason: 'Réponse illisible pour le choix du thème.' }

  for (const candidate of parsed.data.candidates) {
    const tags = candidate.tags.filter((tag): tag is TopicCandidate['tags'][number] =>
      (AUTO_TAGS as readonly string[]).includes(tag))
    if (tags.length === 0) continue
    if (findSimilarTitle(candidate.title, input.existingTitles)) continue

    return {
      ok: true,
      topic: { title: candidate.title, angle: candidate.angle, why: candidate.why, tags: tags.slice(0, 2) },
      model: response.model,
      usage: response.usage,
    }
  }

  return { ok: false, reason: 'Les trois sujets proposés ressemblent à des articles existants.' }
}

// ─── Étape 2 : rédaction ───────────────────────────────────────────────────

type Written =
  | { ok: true; article: GeneratedArticle; model: string; usage?: GeminiUsage }
  /** `usage` : une réponse hors format a quand même été facturée. */
  | { ok: false; reason: string; usage?: GeminiUsage }

export async function writeArticle(input: {
  apiKey: string
  today: Date
  topic: TopicCandidate
  previousIssues?: readonly string[]
}): Promise<Written> {
  const response = await generateJson(
    [
      { text: ARTICLE_SYSTEM_PROMPT },
      { text: buildArticlePrompt({ today: input.today, topic: input.topic, previousIssues: input.previousIssues }) },
    ],
    {
      apiKey: input.apiKey,
      maxOutputTokens: ARTICLE_MAX_TOKENS,
      logLabel: 'blog-article',
      temperature: ARTICLE_TEMPERATURE,
    },
  )
  if (!response.ok) return { ok: false, reason: response.reason }

  const decoded = decodeJson(response.raw)
  if (!decoded.ok) return { ok: false, reason: `JSON invalide (${decoded.error}).`, usage: response.usage }
  const { value: json, adjusted } = fitSoftLimits(decoded.value)
  const parsed = generatedArticleSchema.safeParse(json)
  if (!parsed.success) {
    const details = parsed.error.issues.slice(0, 5).map(issue => describeIssue(issue, json))
    return { ok: false, reason: `Réponse hors format : ${details.join(' ; ')}.`, usage: response.usage }
  }

  const article = parsed.data
  if (adjusted.length > 0) {
    article.reviewerNotes = [
      ...article.reviewerNotes.slice(0, 14),
      `Raccourci automatiquement pour tenir dans la limite : ${adjusted.join(', ')}. À relire.`,
    ]
  }
  return { ok: true, article, model: response.model, usage: response.usage }
}

/**
 * Limites **souples** : l'extrait et le texte alternatif dépassent souvent de
 * quelques caractères — les modèles comptent mal. Réécrire mille mots pour
 * cinq caractères coûte une rédaction entière, et la reprise en introduisait
 * d'autres défauts. On coupe donc au dernier mot qui tient, et le relecteur en
 * est prévenu. Le titre et le corps, eux, restent des limites dures.
 */
const SOFT_LIMITS = [
  { field: 'excerpt', label: 'l’extrait', max: 160, ellipsis: true },
  { field: 'coverImageAlt', label: 'le texte alternatif de l’image', max: 200, ellipsis: false },
] as const

function fitSoftLimits(json: unknown): { value: unknown; adjusted: string[] } {
  if (!json || typeof json !== 'object') return { value: json, adjusted: [] }
  const value = { ...(json as Record<string, unknown>) }
  const adjusted: string[] = []

  for (const { field, label, max, ellipsis } of SOFT_LIMITS) {
    const text = value[field]
    if (typeof text !== 'string' || text.length <= max) continue
    value[field] = cutAtWord(text, ellipsis ? max - 1 : max) + (ellipsis ? '…' : '')
    adjusted.push(label)
  }
  return { value, adjusted }
}

function cutAtWord(text: string, max: number): string {
  const cut = text.slice(0, max + 1)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : text.slice(0, max))
    .replace(/[\s,;:.–-]+$/u, '')
}

// ─── Étape 3 : contrôles ───────────────────────────────────────────────────

/**
 * Contrôles bloquants de la spec (§ 5.4, sauf le schéma, déjà vérifié) :
 * slug libre, titre qui ne double pas un article, MDX qui compile et se rend,
 * puis le lint lexical et structurel d'`editorial.ts`.
 *
 * Rend la liste des défauts, formulés pour être renvoyés au modèle ; vide si
 * l'article est acceptable.
 */
export async function checkArticle(
  article: GeneratedArticle,
  context: { existingTitles: readonly string[] },
): Promise<string[]> {
  const issues: string[] = []

  const taken = await prisma.blogPost.findUnique({ where: { slug: article.slug }, select: { id: true } })
  if (taken) issues.push(`Le slug « ${article.slug} » est déjà pris : choisis-en un autre.`)

  const similar = findSimilarTitle(article.title, context.existingTitles)
  if (similar) issues.push(`Le titre ressemble trop à un article existant (« ${similar} »).`)

  const compiled = await compileArticleMdx(article.mdx)
  if (!compiled.ok) issues.push(`Le corps ne compile pas : ${compiled.error}`)

  for (const issue of blockingIssues(lintArticle(article))) issues.push(issue.message)

  return issues
}

// ─── Utilitaires ───────────────────────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
  title: 'le titre',
  excerpt: 'l’extrait',
  coverImageAlt: 'le texte alternatif de l’image',
  coverPrompt: 'le prompt de l’image',
  mdx: 'le corps',
  reviewerNotes: 'la liste des notes pour le relecteur',
  tags: 'la liste des tags',
}

/**
 * Un défaut de schéma, dit au modèle avec la **mesure** : « l'extrait fait 187
 * caractères, 160 au plus » se corrige ; « Too big » en anglais se répète. Les
 * modèles comptent mal les caractères, il faut leur donner le chiffre.
 */
function describeIssue(issue: z.core.$ZodIssue, json: unknown): string {
  const field = String(issue.path[0] ?? '')
  const label = FIELD_LABELS[field] ?? (field || 'la réponse')
  const value = json && typeof json === 'object' ? (json as Record<string, unknown>)[field] : undefined
  const size = typeof value === 'string' ? value.length : Array.isArray(value) ? value.length : null
  const unit = typeof value === 'string' ? 'caractères' : 'éléments'

  if (issue.code === 'too_big' && size !== null) {
    return `${label} fait ${size} ${unit}, ${String(issue.maximum)} au plus`
  }
  if (issue.code === 'too_small' && size !== null) {
    return `${label} fait ${size} ${unit}, ${String(issue.minimum)} au moins`
  }
  return `${label} : ${issue.message}`
}

function safeJson(raw: string): unknown {
  const decoded = decodeJson(raw)
  return decoded.ok ? decoded.value : null
}

function decodeJson(raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(stripFence(raw)) }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message.slice(0, 120) : 'illisible' }
  }
}

function addUsage(total: { inputTokens: number; outputTokens: number }, usage?: GeminiUsage): void {
  if (!usage) return
  total.inputTokens += usage.inputTokens
  total.outputTokens += usage.outputTokens
}

/** Un échec est tracé dans Sentry avec l'origine et l'étape — c'est tout ce qu'on en fait. */
function fail(
  input: GenerateArticleInput,
  stage: GenerationStage,
  reason: string,
  startedAt: number,
  issues?: string[],
): GenerateArticleResult {
  const durationMs = Date.now() - startedAt
  console.error(`${LOG} échec (${stage}, origine ${input.origin}, ${durationMs} ms) : ${reason}`, issues ?? '')
  Sentry.captureMessage(`${LOG} échec de génération : ${stage}`, {
    level: 'error',
    tags: { 'blog.origin': input.origin, 'blog.stage': stage },
    extra: { reason, issues, durationMs, topic: input.topic },
  })
  return { ok: false, stage, reason, issues }
}
