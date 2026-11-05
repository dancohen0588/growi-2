/**
 * Administration de la bibliothèque des « Secrets de jardinier »
 * (`/admin/secrets`).
 *
 * Même discipline que `blog-admin.service` : toutes les écritures passent par
 * `auditWrite` — l'écriture et sa trace vivent ou meurent ensemble —, et les
 * lectures voient tous les statuts. Le service **valide lui-même** ce qu'il
 * reçoit (`updateGardenTipSchema`, sans le statut) : la Server Action ne fait
 * que lire le formulaire.
 *
 * Après chaque écriture, `forgetPublishedTips()` vide le cache d'une minute du
 * planning, sur l'instance qui a écrit ; les autres suivent dans la minute.
 *
 * Deux règles tiennent la cohérence avec le journal des utilisateurs, qui
 * recopie le **slug** (`CareLog.tipSlug`, `UserTip.slug`, `GardenTipPick.slug`) :
 * - le slug est figé à la création ;
 * - on ne supprime ni un secret publié, ni un brouillon qui a déjà servi.
 */

import { Prisma, type GardenTip } from '@prisma/client'
import { z } from 'zod'
import {
  SECRET_RULE_IDS,
  SECRET_VERDICTS,
  secretPlancheSchema,
  secretSlugSchema,
  updateGardenTipSchema,
  type SecretConditions,
  type SecretPlanche,
  type SecretStatus,
  type SecretVerdict,
} from '@growi/shared'

import { auditWrite } from '@/lib/admin/audit'
import { forbiddenTermsIn } from '@/lib/blog/editorial'
import { prisma } from '@/lib/prisma'
import { ServiceError } from '@/lib/services/errors'
import { forgetPublishedTips } from '@/lib/services/secrets.service'

// ─── Schémas ───────────────────────────────────────────────────────────────

/**
 * Champs éditables. Le statut n'y est pas : il ne change que par « Publier » et
 * « Dépublier », pour que chaque transition ait sa propre ligne au journal.
 */
export const gardenTipEditSchema = updateGardenTipSchema.omit({ status: true })
export type GardenTipEdit = z.infer<typeof gardenTipEditSchema>

/** Création : les mêmes champs, plus le slug — qui ne bougera plus. */
export const createGardenTipSchema = gardenTipEditSchema.extend({ slug: secretSlugSchema })
export type GardenTipCreate = z.infer<typeof createGardenTipSchema>

const FIELD_LABELS: Record<string, string> = {
  slug: 'Identifiant',
  title: 'Titre',
  teaser: 'Accroche',
  story: 'Histoire',
  recipe: 'Recette',
  ingredients: 'Ingrédients',
  evidence: 'Niveau de preuve',
  cautions: 'Précautions',
  prepDays: 'Jours de préparation',
  effortMinutes: 'Effort',
  cooldownDays: 'Délai avant de reproposer',
  conditions: 'Conditions',
  planche: 'Planche',
}

/** Le chemin d'un défaut dans la planche : « Planche › case 2 › légende ». */
const PLANCHE_PATH_LABELS: Record<string, string> = {
  panels: 'case',
  caution: 'précaution',
  art: 'dessin',
  caption: 'légende',
  emphasis: 'passage en gras',
  title: 'titre',
  text: 'texte',
}

function pathLabel(path: readonly PropertyKey[]): string {
  const [head, ...rest] = path.map(String)
  if (head !== 'planche') return [FIELD_LABELS[head] ?? head, ...rest].join(' › ')
  const parts: string[] = [FIELD_LABELS.planche]
  for (const segment of rest) {
    // « case » puis « 2 » font « case 2 » : l'index est montré à partir de 1.
    if (/^\d+$/.test(segment) && parts.length > 1) parts[parts.length - 1] += ` ${Number(segment) + 1}`
    else parts.push(PLANCHE_PATH_LABELS[segment] ?? segment)
  }
  return parts.join(' › ')
}

/**
 * Les défauts du formulaire, en français et avec la mesure : « Accroche :
 * 160 caractères au plus » se corrige, « Too big » se relit trois fois.
 */
export function describeTipIssues(error: z.ZodError): string {
  return error.issues
    .slice(0, 3)
    .map((issue) => `${pathLabel(issue.path)} : ${issueText(issue)}`)
    .join(' ')
}

function issueText(issue: z.ZodError['issues'][number]): string {
  switch (issue.code) {
    case 'too_small':
      if (issue.origin === 'string') return `${issue.minimum} caractères au moins.`
      if (issue.origin === 'array') return `${issue.minimum} élément(s) au moins.`
      return `${issue.minimum} au moins.`
    case 'too_big':
      if (issue.origin === 'string') return `${issue.maximum} caractères au plus.`
      if (issue.origin === 'array') return `${issue.maximum} éléments au plus.`
      return `${issue.maximum} au plus.`
    case 'invalid_format':
      return 'minuscules, chiffres et tirets seulement (ex. « eau-de-banane »).'
    case 'invalid_type':
      return 'valeur manquante ou invalide.'
    case 'invalid_value':
      return 'valeur inconnue.'
    default:
      return issue.message
  }
}

function parseOrThrow<S extends z.ZodTypeAny>(schema: S, raw: unknown): z.infer<S> {
  const parsed = schema.safeParse(raw)
  if (!parsed.success) throw new ServiceError('INVALID_INPUT', describeTipIssues(parsed.error))
  return parsed.data
}

// ─── Normalisation ─────────────────────────────────────────────────────────

/**
 * Une étape par ligne, sans ligne vide ni espace en bord. Un `textarea` part
 * en fins de ligne Windows : sans cela, la moindre retouche réécrivait toute la
 * recette, et les applis afficheraient des étapes vides.
 */
export function normalizeRecipe(recipe: string): string {
  return recipe
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
}

function cleanList(list: readonly string[] | undefined): string[] | undefined {
  if (!list) return undefined
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of list) {
    const value = raw.trim()
    if (!value || seen.has(value.toLowerCase())) continue
    seen.add(value.toLowerCase())
    out.push(value)
  }
  return out.length > 0 ? out : undefined
}

/**
 * Forme canonique des conditions : clés dans un ordre fixe, listes dédoublonnées,
 * **listes vides retirées** (une condition absente ne filtre rien ; une liste
 * vide n'a pas à le laisser deviner), mois triés, `false` retiré là où il vaut
 * « absent ». `edible: false` est gardé : il veut dire « non comestible ».
 *
 * La comparaison avant/après du journal passe aussi par elle, pour qu'un
 * simple réordonnancement ne soit pas noté comme une modification.
 */
export function normalizeConditions(conditions: SecretConditions): SecretConditions {
  const out: SecretConditions = {}
  const set = <K extends keyof SecretConditions>(key: K, value: SecretConditions[K] | undefined) => {
    if (value !== undefined) out[key] = value
  }

  set('categories', cleanList(conditions.categories))
  set('families', cleanList(conditions.families))
  set('genera', cleanList(conditions.genera))
  set('excludeFamilies', cleanList(conditions.excludeFamilies))
  set('excludeGenera', cleanList(conditions.excludeGenera))
  const months = [...new Set(conditions.months ?? [])].sort((a, b) => a - b)
  set('months', months.length > 0 ? months : undefined)
  const locations = [...new Set(conditions.locations ?? [])]
  set('locations', locations.length > 0 ? locations : undefined)
  set('edible', conditions.edible)
  set('notToxic', conditions.notToxic ? true : undefined)
  set('healthStatus', cleanList(conditions.healthStatus))
  set('lunarOnly', conditions.lunarOnly ? true : undefined)

  const weather = conditions.weather
  if (weather) {
    const w: NonNullable<SecretConditions['weather']> = {}
    if (weather.tempMaxAbove != null) w.tempMaxAbove = weather.tempMaxAbove
    if (weather.tempMinBelow != null) w.tempMinBelow = weather.tempMinBelow
    if (weather.rainyRecently) w.rainyRecently = true
    if (Object.keys(w).length > 0) out.weather = w
  }
  return out
}

/**
 * Forme canonique d'une planche : clés dans l'ordre du schéma, `emphasis` et
 * `caution` seulement s'ils existent. Postgres réordonne les clés d'un `jsonb`
 * — la comparaison avant/après du journal passe donc par elle aussi, pour
 * qu'une planche relue de la base ne soit pas notée comme modifiée.
 */
export function canonicalPlanche(planche: SecretPlanche): SecretPlanche {
  return {
    panels: planche.panels.map(({ art, caption, emphasis }) => (emphasis ? { art, caption, emphasis } : { art, caption })),
    ...(planche.caution
      ? { caution: { art: planche.caution.art, title: planche.caution.title, text: planche.caution.text } }
      : {}),
  }
}

/** La planche stockée, comparable — ou telle quelle si elle ne se lit plus. */
function comparablePlanche(value: unknown): unknown {
  if (value == null) return null
  const parsed = secretPlancheSchema.safeParse(value)
  return parsed.success ? canonicalPlanche(parsed.data) : value
}

/**
 * La colonne `planche` à écrire : rien si la saisie n'en parle pas (le
 * formulaire n'a pas de section planche), `DbNull` pour la retirer — un
 * `null` JavaScript écrirait le JSON `null`, que `planche IS NULL` ne verrait
 * pas —, la forme canonique sinon.
 */
function plancheColumn(planche: SecretPlanche | null | undefined) {
  if (planche === undefined) return {}
  return { planche: planche === null ? Prisma.DbNull : (canonicalPlanche(planche) as Prisma.InputJsonObject) }
}

/**
 * Ce qu'on écrit en base, à partir d'une saisie validée.
 *
 * `story` et `cautions` vides valent `null` ici et non dans le schéma : la
 * branche `.or(z.literal('')…)` d'`updateGardenTipSchema` n'est jamais
 * atteinte, la chaîne vide passant déjà par la première.
 */
function toColumns(input: GardenTipEdit) {
  return {
    title: input.title,
    teaser: input.teaser,
    story: input.story || null,
    recipe: input.recipe,
    ingredients: cleanList(input.ingredients) ?? [],
    evidence: input.evidence,
    cautions: input.cautions || null,
    prepDays: input.prepDays,
    effortMinutes: input.effortMinutes ?? null,
    cooldownDays: input.cooldownDays,
    conditions: normalizeConditions(input.conditions) as Prisma.InputJsonObject,
    ...plancheColumn(input.planche),
  }
}

/**
 * Normalise puis valide. La recette est nettoyée **avant** la validation : sa
 * longueur minimale porte sur les étapes, pas sur des lignes vides.
 */
function readEdit(raw: unknown): GardenTipEdit {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const prepared = typeof record.recipe === 'string' ? { ...record, recipe: normalizeRecipe(record.recipe) } : record
  const input = parseOrThrow(gardenTipEditSchema, prepared)
  assertNoForbiddenTerms(input)
  return input
}

/**
 * Le mot « IA » ne paraît dans aucun contenu destiné aux utilisateurs — même
 * liste que le blog (`lib/blog/editorial.ts`), sur tout ce que la carte et le
 * grimoire affichent.
 */
function assertNoForbiddenTerms(
  input: Pick<GardenTipEdit, 'title' | 'teaser' | 'story' | 'recipe' | 'ingredients' | 'cautions' | 'planche'>,
) {
  const planche = input.planche
    ? [
        ...input.planche.panels.map((panel) => panel.caption),
        input.planche.caution?.title,
        input.planche.caution?.text,
      ]
    : []
  const text = [input.title, input.teaser, input.story, input.recipe, ...input.ingredients, input.cautions, ...planche]
    .filter(Boolean)
    .join('\n')
  const forbidden = forbiddenTermsIn(text)
  if (forbidden.length > 0) {
    throw new ServiceError('INVALID_INPUT', `Termes interdits dans un contenu destiné aux jardiniers : ${forbidden.join(', ')}.`)
  }
}

// ─── Statistiques ──────────────────────────────────────────────────────────

/**
 * Ce qu'est devenu un secret. Des **comptes**, jamais des ratios : la page met
 * en forme `revealed / picked` en nommant le dénominateur, pour qu'un « 50 % »
 * portant sur deux tirages ne se lise pas comme une tendance.
 *
 * Les unités diffèrent et la page le dit : un tirage est une semaine d'un
 * jardin, un dévoilement ou un refus un compte, un essai un geste sur une plante.
 */
export interface TipStats {
  /** Semaines-jardins où il a été le secret de la semaine (`garden_tip_picks`). */
  picked: number
  /** Comptes qui l'ont dévoilé (`user_tips.revealedAt`). */
  revealed: number
  /** Comptes qui ont dit « Pas pour moi » (`user_tips.dismissedAt`). */
  dismissed: number
  /** Gestes « Je tente » (`care_logs`, règle `r20-secret`). */
  tried: number
  /** Essais qui ont reçu un verdict — le dénominateur de `verdicts`. */
  answered: number
  verdicts: Record<SecretVerdict, number>
}

export function emptyStats(): TipStats {
  return {
    picked: 0,
    revealed: 0,
    dismissed: 0,
    tried: 0,
    answered: 0,
    verdicts: { WORKED: 0, MEH: 0, FAILED: 0 },
  }
}

/**
 * Statistiques de plusieurs secrets en quatre `groupBy` — pas une requête par
 * ligne de la liste.
 */
export async function statsForSlugs(slugs: readonly string[]): Promise<Map<string, TipStats>> {
  const stats = new Map<string, TipStats>(slugs.map((slug) => [slug, emptyStats()]))
  if (slugs.length === 0) return stats
  const inSlugs = { in: [...slugs] }

  const [picks, revealed, dismissed, trials] = await Promise.all([
    prisma.gardenTipPick.groupBy({ by: ['slug'], where: { slug: inSlugs }, _count: { _all: true } }),
    prisma.userTip.groupBy({ by: ['slug'], where: { slug: inSlugs, revealedAt: { not: null } }, _count: { _all: true } }),
    prisma.userTip.groupBy({ by: ['slug'], where: { slug: inSlugs, dismissedAt: { not: null } }, _count: { _all: true } }),
    prisma.careLog.groupBy({
      by: ['tipSlug', 'tipVerdict'],
      where: { ruleId: SECRET_RULE_IDS.discover, tipSlug: inSlugs },
      _count: { _all: true },
    }),
  ])

  for (const row of picks) {
    const entry = stats.get(row.slug)
    if (entry) entry.picked = row._count._all
  }
  for (const row of revealed) {
    const entry = stats.get(row.slug)
    if (entry) entry.revealed = row._count._all
  }
  for (const row of dismissed) {
    const entry = stats.get(row.slug)
    if (entry) entry.dismissed = row._count._all
  }
  for (const row of trials) {
    const entry = row.tipSlug ? stats.get(row.tipSlug) : undefined
    if (!entry) continue
    const count = row._count._all
    entry.tried += count
    // Un verdict hors liste (écrit par une version future ?) compte comme un
    // essai, pas comme une réponse : on ne sait pas le ranger.
    if (row.tipVerdict && (SECRET_VERDICTS as readonly string[]).includes(row.tipVerdict)) {
      entry.verdicts[row.tipVerdict as SecretVerdict] += count
      entry.answered += count
    }
  }
  return stats
}

export async function statsForSlug(slug: string): Promise<TipStats> {
  return (await statsForSlugs([slug])).get(slug) ?? emptyStats()
}

// ─── Lectures ──────────────────────────────────────────────────────────────

const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  teaser: true,
  evidence: true,
  status: true,
  updatedAt: true,
} as const satisfies Prisma.GardenTipSelect

export type TipAdminRow = Prisma.GardenTipGetPayload<{ select: typeof LIST_SELECT }> & { stats: TipStats }

/**
 * Secrets d'un statut, avec leurs statistiques. Une bibliothèque compte des
 * dizaines de secrets : pas de pagination, par ordre alphabétique.
 */
export async function listTipsByStatus(status: SecretStatus): Promise<TipAdminRow[]> {
  const rows = await prisma.gardenTip.findMany({
    where: { status },
    orderBy: [{ title: 'asc' }, { id: 'asc' }],
    select: LIST_SELECT,
  })
  const stats = await statsForSlugs(rows.map((row) => row.slug))
  return rows.map((row) => ({ ...row, stats: stats.get(row.slug) ?? emptyStats() }))
}

export async function countTipsByStatus(): Promise<Record<SecretStatus, number>> {
  const groups = await prisma.gardenTip.groupBy({ by: ['status'], _count: { _all: true } })
  const counts: Record<SecretStatus, number> = { DRAFT: 0, PUBLISHED: 0 }
  for (const group of groups) {
    if (group.status in counts) counts[group.status as SecretStatus] = group._count._all
  }
  return counts
}

/** @throws ServiceError('NOT_FOUND') */
export async function getTipForAdmin(id: string): Promise<GardenTip> {
  const tip = await prisma.gardenTip.findUnique({ where: { id } })
  if (!tip) throw new ServiceError('NOT_FOUND', 'Secret introuvable.')
  return tip
}

// ─── Écritures ─────────────────────────────────────────────────────────────

/**
 * Crée un secret, **toujours en brouillon** : il ne sera tiré qu'après un
 * « Publier » explicite, depuis sa fiche.
 *
 * @throws ServiceError('INVALID_INPUT') saisie invalide ou terme interdit.
 * @throws ServiceError('CONFLICT') slug déjà pris.
 */
export async function createGardenTip(actorId: string, raw: unknown): Promise<GardenTip> {
  const record = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const slug = parseOrThrow(z.object({ slug: secretSlugSchema }), { slug: typeof record.slug === 'string' ? record.slug.trim() : record.slug }).slug
  const input = readEdit(record)

  if (await prisma.gardenTip.findUnique({ where: { slug }, select: { id: true } })) {
    throw new ServiceError('CONFLICT', `L’identifiant « ${slug} » est déjà pris.`)
  }

  try {
    const tip = await auditWrite(
      (tx) => tx.gardenTip.create({ data: { slug, status: 'DRAFT' satisfies SecretStatus, ...toColumns(input) } }),
      (created) => ({
        actorId,
        action: 'secret.create',
        targetType: 'garden_tip',
        targetId: created.id,
        details: { slug, titre: input.title },
      }),
    )
    forgetPublishedTips()
    return tip
  } catch (err) {
    // Deux créations simultanées du même slug : la seconde perd à l'index.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      throw new ServiceError('CONFLICT', `L’identifiant « ${slug} » est déjà pris.`)
    }
    throw err
  }
}

const EDITABLE_FIELDS = [
  'title',
  'teaser',
  'story',
  'recipe',
  'ingredients',
  'evidence',
  'cautions',
  'prepDays',
  'effortMinutes',
  'cooldownDays',
  'conditions',
] as const

/** Les champs changés, sous leur nom de colonne — la planche comprise, quand la saisie en parle. */
function changedFields(before: GardenTip, input: GardenTipEdit, data: ReturnType<typeof toColumns>): string[] {
  const canonicalBefore = { ...before, conditions: comparableConditions(before.conditions) }
  const changed: string[] = EDITABLE_FIELDS.filter(
    (field) => JSON.stringify(data[field]) !== JSON.stringify(canonicalBefore[field]),
  )
  if (input.planche !== undefined) {
    const after = input.planche === null ? null : canonicalPlanche(input.planche)
    if (JSON.stringify(after) !== JSON.stringify(comparablePlanche(before.planche))) changed.push('planche')
  }
  return changed
}

/**
 * Enregistre une édition. Le slug n'est jamais écrit : un `slug` présent dans
 * la saisie est ignoré (le schéma d'édition ne le connaît pas).
 *
 * @throws ServiceError('NOT_FOUND' | 'INVALID_INPUT')
 */
export async function updateGardenTip(actorId: string, id: string, raw: unknown): Promise<GardenTip> {
  const before = await getTipForAdmin(id)
  const input = readEdit(raw)
  const data = toColumns(input)
  const changed = changedFields(before, input, data)

  const tip = await auditWrite(
    (tx) => tx.gardenTip.update({ where: { id }, data }),
    // Les noms des champs, pas leur contenu : le journal s'exporte, et la
    // recette n'y a rien à faire.
    { actorId, action: 'secret.update', targetType: 'garden_tip', targetId: id, details: { slug: before.slug, champs: changed } },
  )
  forgetPublishedTips()
  return tip
}

/** Conditions stockées, ramenées à la forme canonique — ou telles quelles si elles ne se lisent pas. */
function comparableConditions(value: unknown): unknown {
  const parsed = gardenTipEditSchema.shape.conditions.safeParse(value ?? {})
  return parsed.success ? normalizeConditions(parsed.data) : value
}

/**
 * DRAFT → PUBLISHED. Le secret entre au tirage dès la minute suivante.
 *
 * La version **enregistrée** est revalidée : un secret importé ou écrit avant
 * une règle, ou dont les conditions ne se lisent plus, serait sinon écarté en
 * silence par le planning (`secrets.service.toRecord`).
 */
export async function publishGardenTip(actorId: string, id: string): Promise<GardenTip> {
  const tip = await getTipForAdmin(id)
  if (tip.status === 'PUBLISHED') throw new ServiceError('CONFLICT', 'Ce secret est déjà publié.')

  const stored = gardenTipEditSchema.safeParse({
    ...tip,
    story: tip.story ?? undefined,
    cautions: tip.cautions ?? undefined,
    effortMinutes: tip.effortMinutes ?? undefined,
  })
  if (!stored.success) {
    throw new ServiceError('INVALID_INPUT', `Publication impossible — ${describeTipIssues(stored.error)}`)
  }
  assertNoForbiddenTerms(stored.data)

  const published = await auditWrite(
    (tx) => tx.gardenTip.update({ where: { id }, data: { status: 'PUBLISHED' satisfies SecretStatus } }),
    { actorId, action: 'secret.publish', targetType: 'garden_tip', targetId: id, details: { slug: tip.slug } },
  )
  forgetPublishedTips()
  return published
}

/**
 * PUBLISHED → DRAFT. Il n'est plus tiré, et sa carte « à découvrir »
 * disparaît aussitôt des jardins qui l'avaient tirée cette semaine — c'est
 * l'arrêt d'urgence d'une recette fautive. Ce qui est en cours continue :
 * « c'est prêt » et « Ça a marché ? » relisent un secret dépublié, et il reste
 * au grimoire de qui l'avait découvert.
 */
export async function unpublishGardenTip(actorId: string, id: string): Promise<GardenTip> {
  const tip = await getTipForAdmin(id)
  if (tip.status !== 'PUBLISHED') throw new ServiceError('CONFLICT', 'Ce secret n’est pas publié.')

  const draft = await auditWrite(
    (tx) => tx.gardenTip.update({ where: { id }, data: { status: 'DRAFT' satisfies SecretStatus } }),
    { actorId, action: 'secret.unpublish', targetType: 'garden_tip', targetId: id, details: { slug: tip.slug } },
  )
  forgetPublishedTips()
  return draft
}

/**
 * Ce qui, dans les données des utilisateurs, porte le slug d'un secret. Un
 * seul suffit à interdire la suppression : le journal d'un jardinier
 * pointerait vers un secret disparu, et ses suites ne se liraient plus.
 */
export async function tipUsage(slug: string): Promise<{ picks: number; trials: number; userTips: number }> {
  const [picks, trials, userTips] = await Promise.all([
    prisma.gardenTipPick.count({ where: { slug } }),
    prisma.careLog.count({ where: { tipSlug: slug } }),
    prisma.userTip.count({ where: { slug } }),
  ])
  return { picks, trials, userTips }
}

/**
 * Suppression physique d'un brouillon **qui n'a jamais servi**. Un secret
 * publié se dépublie d'abord ; un brouillon déjà tiré, essayé ou dévoilé reste
 * en brouillon pour toujours — c'est ce qui le retire du tirage.
 */
export async function deleteGardenTip(actorId: string, id: string): Promise<{ slug: string }> {
  const tip = await getTipForAdmin(id)
  if (tip.status === 'PUBLISHED') {
    throw new ServiceError('CONFLICT', 'Un secret publié ne se supprime pas : dépublie-le d’abord.')
  }
  const usage = await tipUsage(tip.slug)
  if (usage.picks + usage.trials + usage.userTips > 0) {
    throw new ServiceError(
      'CONFLICT',
      'Ce secret a déjà été proposé à des jardiniers : il reste en brouillon, ce qui suffit à ne plus le tirer.',
    )
  }

  await auditWrite(
    (tx) => tx.gardenTip.delete({ where: { id } }),
    // Le titre survit ainsi au secret : sans lui, la ligne du journal ne
    // dirait plus ce qui a été supprimé.
    { actorId, action: 'secret.delete', targetType: 'garden_tip', targetId: id, details: { slug: tip.slug, titre: tip.title } },
  )
  forgetPublishedTips()
  return { slug: tip.slug }
}
