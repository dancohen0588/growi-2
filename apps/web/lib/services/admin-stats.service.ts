/**
 * Indicateurs du tableau de bord.
 *
 * Les séries sont écrites en **SQL brut** : Prisma ne sait pas grouper par
 * semaine. Trois précautions y reviennent partout :
 *
 * 1. **Tout est calculé en UTC** (`AT TIME ZONE 'UTC'`), comme `IdentifyQuota`
 *    et `user_activities`. Laisser Postgres employer le fuseau de la session
 *    ferait bouger les bornes de semaine selon l'endroit d'où l'on interroge.
 * 2. **Les semaines commencent le lundi** — c'est déjà ce que fait
 *    `date_trunc('week', …)` en Postgres, et c'est la convention ISO retenue.
 * 3. **Chaque `COUNT` est casté en `::int`.** Postgres renvoie un `bigint`, que
 *    Prisma remet en `BigInt` — non sérialisable vers un composant client, et
 *    surprenant en arithmétique.
 *
 * Tout est calculé à la demande et mis en cache dix minutes. À ces volumes
 * aucune table d'agrégats n'est nécessaire ; on en créera une le jour où le
 * tableau de bord dépassera la seconde.
 */

import { Prisma } from '@prisma/client'
import { unstable_cache } from 'next/cache'

import { prisma } from '@/lib/prisma'

/** Durée de vie du cache, en secondes. */
export const STATS_CACHE_SECONDS = 600

export const SIGNUP_WEEKS = 26
export const ACTIVE_WEEKS = 12

export type WeekPoint = { week: string; value: number }
export type SurfaceWeekPoint = { week: string; web: number; mobile: number }

// ─── Utilitaires de semaine ────────────────────────────────────────────────

/** Lundi de la semaine d'une date, en UTC, au format `YYYY-MM-DD`. */
export function weekStart(date: Date): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  // getUTCDay() : 0 = dimanche. On ramène au lundi précédent.
  const offset = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - offset)
  return d.toISOString().slice(0, 10)
}

/**
 * Les `count` derniers lundis, du plus ancien au plus récent.
 *
 * Sert à **compléter les trous** : une semaine sans inscription n'apparaît pas
 * dans le résultat SQL, et une courbe qui saute ces semaines ment sur la forme
 * de la croissance.
 */
export function lastWeeks(count: number, from: Date = new Date()): string[] {
  const current = new Date(`${weekStart(from)}T00:00:00.000Z`)
  return Array.from({ length: count }, (_, index) => {
    const d = new Date(current)
    d.setUTCDate(d.getUTCDate() - (count - 1 - index) * 7)
    return d.toISOString().slice(0, 10)
  })
}

/** Complète une série creuse avec des zéros sur toutes les semaines attendues. */
function fillWeeks(weeks: string[], rows: { week: Date | string; count: number }[]): WeekPoint[] {
  const byWeek = new Map(
    rows.map((row) => [
      typeof row.week === 'string' ? row.week.slice(0, 10) : row.week.toISOString().slice(0, 10),
      Number(row.count),
    ]),
  )
  return weeks.map((week) => ({ week, value: byWeek.get(week) ?? 0 }))
}

/** Jour UTC `YYYY-MM-DD` d'il y a `days` jours. Même convention que la table. */
function dayAgo(days: number, from: Date = new Date()): string {
  return new Date(from.getTime() - days * 86_400_000).toISOString().slice(0, 10)
}

// ─── Comptes ───────────────────────────────────────────────────────────────

export type AccountStats = {
  total: number
  onboarded: number
  disabled: number
  admins: number
  withPassword: number
  byProvider: { provider: string; count: number }[]
  signupsThisWeek: number
  signupsLastWeek: number
  signupsByWeek: WeekPoint[]
}

async function accountStats(now: Date): Promise<AccountStats> {
  const weeks = lastWeeks(SIGNUP_WEEKS, now)
  const since = new Date(`${weeks[0]}T00:00:00.000Z`)

  const rows = await prisma.$queryRaw<{ week: Date; count: number }[]>(Prisma.sql`
    SELECT date_trunc('week', "createdAt" AT TIME ZONE 'UTC')::date AS week,
           COUNT(*)::int AS count
    FROM users
    WHERE "createdAt" >= ${since}
    GROUP BY 1
    ORDER BY 1
  `)

  const byWeek = fillWeeks(weeks, rows)

  const [total, onboarded, disabled, admins, withPassword, providers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { onboarded: true } }),
    prisma.user.count({ where: { disabledAt: { not: null } } }),
    prisma.user.count({ where: { role: 'ADMIN' } }),
    prisma.user.count({ where: { password: { not: null } } }),
    prisma.account.groupBy({ by: ['provider'], _count: { _all: true } }),
  ])

  return {
    total,
    onboarded,
    disabled,
    admins,
    withPassword,
    byProvider: providers.map((p) => ({ provider: p.provider, count: p._count._all })),
    signupsThisWeek: byWeek.at(-1)?.value ?? 0,
    signupsLastWeek: byWeek.at(-2)?.value ?? 0,
    signupsByWeek: byWeek,
  }
}

// ─── Activité ──────────────────────────────────────────────────────────────

export type ActiveStats = {
  dau: { web: number; mobile: number }
  wau: { web: number; mobile: number }
  mau: { web: number; mobile: number }
  byWeek: SurfaceWeekPoint[]
  /** Jour de la première trace, ou `null`. L'histoire ne remonte pas avant. */
  since: string | null
}

async function activeStats(now: Date): Promise<ActiveStats> {
  const weeks = lastWeeks(ACTIVE_WEEKS, now)

  // `day` est une chaîne `YYYY-MM-DD` : la comparaison lexicographique y est
  // équivalente à la comparaison de dates, et évite un cast par ligne.
  const windows = await prisma.$queryRaw<
    { window: string; surface: string; count: number }[]
  >(Prisma.sql`
    SELECT w.name AS window, a.surface, COUNT(DISTINCT a."userId")::int AS count
    FROM (VALUES ('dau', ${dayAgo(0, now)}), ('wau', ${dayAgo(6, now)}), ('mau', ${dayAgo(29, now)}))
         AS w(name, since)
    JOIN user_activities a ON a.day >= w.since
    GROUP BY w.name, a.surface
  `)

  const pick = (name: string) => ({
    web: windows.find((r) => r.window === name && r.surface === 'web')?.count ?? 0,
    mobile: windows.find((r) => r.window === name && r.surface === 'mobile')?.count ?? 0,
  })

  const weekly = await prisma.$queryRaw<{ week: Date; surface: string; count: number }[]>(
    Prisma.sql`
      SELECT date_trunc('week', a.day::date)::date AS week,
             a.surface,
             COUNT(DISTINCT a."userId")::int AS count
      FROM user_activities a
      WHERE a.day >= ${weeks[0]}
      GROUP BY 1, 2
      ORDER BY 1
    `,
  )

  const web = fillWeeks(
    weeks,
    weekly.filter((r) => r.surface === 'web'),
  )
  const mobile = fillWeeks(
    weeks,
    weekly.filter((r) => r.surface === 'mobile'),
  )

  const first = await prisma.userActivity.findFirst({
    orderBy: { day: 'asc' },
    select: { day: true },
  })

  return {
    dau: pick('dau'),
    wau: pick('wau'),
    mau: pick('mau'),
    byWeek: weeks.map((week, index) => ({
      week,
      web: web[index].value,
      mobile: mobile[index].value,
    })),
    since: first?.day ?? null,
  }
}

// ─── Rétention ─────────────────────────────────────────────────────────────

export type RetentionPoint = { week: string; cohort: number; retained: number }

/**
 * Part des comptes créés en semaine S revus au moins une fois en S+1..S+4.
 *
 * Les cohortes de moins de cinq semaines sont volontairement exclues : leur
 * fenêtre d'observation n'est pas close, et les afficher ferait plonger la
 * courbe à droite pour une raison qui n'a rien à voir avec le produit.
 */
async function retention(now: Date, weeksBack = 12): Promise<RetentionPoint[]> {
  const weeks = lastWeeks(weeksBack + 5, now).slice(0, weeksBack)
  if (weeks.length === 0) return []

  const since = new Date(`${weeks[0]}T00:00:00.000Z`)
  const until = new Date(`${weeks.at(-1)}T00:00:00.000Z`)
  until.setUTCDate(until.getUTCDate() + 7)

  return prisma.$queryRaw<RetentionPoint[]>(Prisma.sql`
    WITH cohortes AS (
      SELECT id, date_trunc('week', "createdAt" AT TIME ZONE 'UTC')::date AS week
      FROM users
      WHERE "createdAt" >= ${since} AND "createdAt" < ${until}
    )
    SELECT to_char(c.week, 'YYYY-MM-DD') AS week,
           COUNT(*)::int AS cohort,
           COUNT(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM user_activities a
               WHERE a."userId" = c.id
                 AND a.day::date >= c.week + 7
                 AND a.day::date < c.week + 35
             )
           )::int AS retained
    FROM cohortes c
    GROUP BY c.week
    ORDER BY c.week
  `)
}

// ─── Jardin ────────────────────────────────────────────────────────────────

export type GardenStats = {
  gardens: number
  plants: number
  plantsPerOnboarded: number
  plantsByWeek: WeekPoint[]
}

async function gardenStats(now: Date): Promise<GardenStats> {
  const weeks = lastWeeks(SIGNUP_WEEKS, now)
  const since = new Date(`${weeks[0]}T00:00:00.000Z`)

  const [gardens, plants, onboardedPlants, onboarded, rows] = await Promise.all([
    prisma.garden.count(),
    prisma.plantInstance.count(),
    // Le numérateur de la moyenne : **les plantes des comptes onboardés**, pas
    // toutes. Diviser l'ensemble des plantes par les seuls comptes onboardés
    // rapporterait deux populations différentes l'une à l'autre et donnerait
    // une moyenne absurde tant que peu de comptes ont terminé l'onboarding.
    prisma.plantInstance.count({ where: { user: { onboarded: true } } }),
    prisma.user.count({ where: { onboarded: true } }),
    prisma.$queryRaw<{ week: Date; count: number }[]>(Prisma.sql`
      SELECT date_trunc('week', "dateAdded" AT TIME ZONE 'UTC')::date AS week,
             COUNT(*)::int AS count
      FROM plant_instances
      WHERE "dateAdded" >= ${since}
      GROUP BY 1
      ORDER BY 1
    `),
  ])

  return {
    gardens,
    plants,
    plantsPerOnboarded: onboarded > 0 ? onboardedPlants / onboarded : 0,
    plantsByWeek: fillWeeks(weeks, rows),
  }
}

// ─── Usage de l'IA ─────────────────────────────────────────────────────────

export type AiStats = {
  diagnoses: number
  chatMessages: number
  anonymousIdentifications: number
  diagnosesByWeek: WeekPoint[]
  chatByWeek: WeekPoint[]
  /** Répartition des diagnostics par modèle — le repli change en silence. */
  byModel: { model: string; count: number }[]
}

async function aiStats(now: Date): Promise<AiStats> {
  const weeks = lastWeeks(ACTIVE_WEEKS, now)
  const since = new Date(`${weeks[0]}T00:00:00.000Z`)

  const [diagnoses, chatMessages, identifications, diagRows, chatRows, models] =
    await Promise.all([
      prisma.diagnosis.count(),
      prisma.message.count({ where: { role: 'user' } }),
      prisma.identifyQuota.aggregate({ _sum: { count: true } }),
      prisma.$queryRaw<{ week: Date; count: number }[]>(Prisma.sql`
        SELECT date_trunc('week', "createdAt" AT TIME ZONE 'UTC')::date AS week,
               COUNT(*)::int AS count
        FROM diagnoses WHERE "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1
      `),
      prisma.$queryRaw<{ week: Date; count: number }[]>(Prisma.sql`
        SELECT date_trunc('week', "createdAt" AT TIME ZONE 'UTC')::date AS week,
               COUNT(*)::int AS count
        FROM messages WHERE role = 'user' AND "createdAt" >= ${since}
        GROUP BY 1 ORDER BY 1
      `),
      prisma.diagnosis.groupBy({ by: ['model'], _count: { _all: true } }),
    ])

  return {
    diagnoses,
    chatMessages,
    anonymousIdentifications: identifications._sum.count ?? 0,
    diagnosesByWeek: fillWeeks(weeks, diagRows),
    chatByWeek: fillWeeks(weeks, chatRows),
    byModel: models
      .map((m) => ({ model: m.model ?? 'inconnu', count: m._count._all }))
      .sort((a, b) => b.count - a.count),
  }
}

// ─── Push et messagerie ────────────────────────────────────────────────────

export type OpsStats = {
  usersWithPush: number
  pushByPlatform: { platform: string; count: number }[]
  newMessages: number
  /** Délai médian de première réponse, en heures. `null` si aucune réponse. */
  medianReplyHours: number | null
}

async function opsStats(): Promise<OpsStats> {
  const [pushUsers, platforms, newMessages, median] = await Promise.all([
    prisma.pushToken
      .findMany({ distinct: ['userId'], select: { userId: true } })
      .then((rows) => rows.length),
    prisma.pushToken.groupBy({ by: ['platform'], _count: { _all: true } }),
    prisma.contactMessage.count({ where: { status: 'new' } }),
    prisma.$queryRaw<{ hours: number | null }[]>(Prisma.sql`
      SELECT percentile_cont(0.5) WITHIN GROUP (
               ORDER BY EXTRACT(EPOCH FROM (p.first_reply - m."createdAt")) / 3600
             ) AS hours
      FROM contact_messages m
      JOIN (
        SELECT "messageId", MIN("sentAt") AS first_reply
        FROM contact_replies GROUP BY "messageId"
      ) p ON p."messageId" = m.id
    `),
  ])

  return {
    usersWithPush: pushUsers,
    pushByPlatform: platforms.map((p) => ({ platform: p.platform, count: p._count._all })),
    newMessages,
    medianReplyHours: median[0]?.hours != null ? Number(median[0].hours) : null,
  }
}

// ─── Assemblage ────────────────────────────────────────────────────────────

export type AdminStats = {
  accounts: AccountStats
  active: ActiveStats
  retention: RetentionPoint[]
  garden: GardenStats
  ai: AiStats
  ops: OpsStats
  generatedAt: string
}

/** Sans cache — c'est cette fonction que les tests appellent. */
export async function computeStats(now: Date = new Date()): Promise<AdminStats> {
  const [accounts, active, retentionPoints, garden, ai, ops] = await Promise.all([
    accountStats(now),
    activeStats(now),
    retention(now),
    gardenStats(now),
    aiStats(now),
    opsStats(),
  ])

  return {
    accounts,
    active,
    retention: retentionPoints,
    garden,
    ai,
    ops,
    generatedAt: now.toISOString(),
  }
}

/**
 * Les indicateurs, mis en cache dix minutes.
 *
 * `unstable_cache` ne peut pas envelopper une fonction qui lit `headers()` ou
 * `cookies()` : celle-ci ne fait que des requêtes, et l'appelant a déjà
 * authentifié.
 */
export const getAdminStats = unstable_cache(async () => computeStats(), ['admin-stats'], {
  revalidate: STATS_CACHE_SECONDS,
  tags: ['admin-stats'],
})
