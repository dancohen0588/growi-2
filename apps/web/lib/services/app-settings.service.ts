/**
 * Réglages applicatifs modifiables sans déploiement (`app_settings`).
 *
 * Pour l'instant, ceux de la génération d'articles : la cadence (réglée depuis
 * l'admin), la date de la dernière génération, et le verrou qui empêche deux
 * passages du cron de générer en même temps.
 */

import { blogCadenceSchema, type BlogCadence } from '@growi/shared'

import { prisma } from '@/lib/prisma'

export const SETTING_KEYS = {
  blogCadence: 'blog.cadence',
  blogLastGenerationAt: 'blog.last_generation_at',
  blogGenerationLock: 'blog.generation_lock',
} as const

/** Valeur de départ, tant que personne ne l'a réglée dans l'admin. */
export const DEFAULT_BLOG_CADENCE: BlogCadence = 'biweekly'

/**
 * Jours écoulés à partir desquels une génération est due. Un jour de moins que
 * la période : le cron passe chaque lundi à la même heure, et une génération
 * finie à 7 h 00 min 40 s ne doit pas faire manquer le lundi « pile » suivant.
 */
export const CADENCE_MIN_DAYS: Record<BlogCadence, number> = {
  weekly: 6,
  biweekly: 13,
  monthly: 27,
}

/** Un passage démarré il y a moins longtemps bloque le suivant. */
export const GENERATION_LOCK_MS = 5 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

// ─── Cadence ───────────────────────────────────────────────────────────────

export async function getBlogCadence(): Promise<BlogCadence> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEYS.blogCadence } })
  // Une valeur illisible vaut « pas réglée » : mieux vaut le rythme par défaut
  // qu'un cron qui s'arrête sans rien dire.
  return blogCadenceSchema.safeParse(row?.value).data ?? DEFAULT_BLOG_CADENCE
}

export async function setBlogCadence(cadence: BlogCadence): Promise<void> {
  const value = blogCadenceSchema.parse(cadence)
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEYS.blogCadence },
    create: { key: SETTING_KEYS.blogCadence, value },
    update: { value },
  })
}

// ─── Dernière génération ───────────────────────────────────────────────────

export async function getLastGenerationAt(): Promise<Date | null> {
  const row = await prisma.appSetting.findUnique({ where: { key: SETTING_KEYS.blogLastGenerationAt } })
  return parseDate(row?.value)
}

export async function setLastGenerationAt(date: Date): Promise<void> {
  const value = date.toISOString()
  await prisma.appSetting.upsert({
    where: { key: SETTING_KEYS.blogLastGenerationAt },
    create: { key: SETTING_KEYS.blogLastGenerationAt, value },
    update: { value },
  })
}

/** Aucune génération encore faite : elle est due. */
export function isGenerationDue(cadence: BlogCadence, last: Date | null, now: Date): boolean {
  if (!last) return true
  return now.getTime() - last.getTime() >= CADENCE_MIN_DAYS[cadence] * DAY_MS
}

// ─── Verrou ────────────────────────────────────────────────────────────────

/**
 * Prend le verrou de génération, ou rend `false` s'il est tenu depuis moins de
 * cinq minutes.
 *
 * Une seule instruction SQL, et non « lire puis écrire » : Vercel peut relancer
 * un cron, et deux passages qui liraient en même temps un verrou libre le
 * prendraient tous les deux. Ici, Postgres n'écrit que si la ligne n'existe
 * pas ou si elle a expiré, et `RETURNING` dit qui a gagné.
 */
export async function acquireGenerationLock(now: Date = new Date()): Promise<boolean> {
  const expiredBefore = new Date(now.getTime() - GENERATION_LOCK_MS)
  const rows = await prisma.$queryRaw<Array<{ key: string }>>`
    INSERT INTO app_settings (key, value, "updatedAt")
    VALUES (${SETTING_KEYS.blogGenerationLock}, to_jsonb(${now.toISOString()}::text), now())
    ON CONFLICT (key) DO UPDATE
      SET value = EXCLUDED.value, "updatedAt" = now()
      WHERE (app_settings.value #>> '{}')::timestamptz < ${expiredBefore.toISOString()}::timestamptz
    RETURNING key
  `
  return rows.length > 0
}

/** Rend le verrou. Sans effet s'il n'est pas tenu. */
export async function releaseGenerationLock(): Promise<void> {
  await prisma.appSetting.deleteMany({ where: { key: SETTING_KEYS.blogGenerationLock } })
}

// ─── Utilitaires ───────────────────────────────────────────────────────────

function parseDate(value: unknown): Date | null {
  if (typeof value !== 'string') return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
