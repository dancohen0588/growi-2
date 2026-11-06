/**
 * La section « Sève » du tableau de bord admin (phase 8 du plan
 * `~/Growi/Documentation/spec/17-plan-seve.md`).
 *
 * **Pas de groupe témoin** (décision du 06/11/2026 : à une centaine de
 * testeurs, il ne prouverait rien et priverait des comptes de la nouveauté).
 * La mesure est donc un **avant/après** autour du lancement — la date du
 * premier gain écrit — et un suivi d'usage. Ce qu'un avant/après ne dit pas :
 * si la saison, ou un autre changement livré en même temps, est la vraie
 * cause. La page le rappelle.
 *
 * Mêmes conventions que `admin-stats.service` : SQL brut pour ce que Prisma ne
 * sait pas grouper par semaine, tout en UTC, semaines ISO (lundi), chaque
 * `COUNT` casté en `::int`, séries complétées à zéro. Les requêtes partent
 * **par petits groupes** : le pool de Prisma vaut une connexion en production.
 *
 * Tout compte y figure, consentement à la mesure d'usage ou non : ce sont des
 * comptages en base, pas des événements PostHog.
 */

import { SAP_HOME_THEMES, SAP_KINDS, SECRET_RULE_IDS, sapRings, type SapHomeTheme, type SapKind } from '@growi/shared'
import { Prisma } from '@prisma/client'
import { unstable_cache } from 'next/cache'

import { prisma } from '@/lib/prisma'
import { STATS_CACHE_SECONDS, lastWeeks, type WeekPoint } from '@/lib/services/admin-stats.service'

export const SAP_STATS_WEEKS = 12
/** La fenêtre de comparaison avant/après, en semaines. */
const COMPARE_WEEKS = 4
/** J30 : revu au moins une fois entre le 28ᵉ et le 35ᵉ jour après l'inscription. */
const J30_FROM_DAYS = 28
const J30_TO_DAYS = 35
const DAY_MS = 86_400_000

export type RatioWeekPoint = { week: string; gestures: number; active: number }

export interface SapStats {
  /** Le premier gain écrit — le lancement. Nul tant que personne n'a rien gagné. */
  launchedAt: string | null
  accountsWithSap: number
  totalSap: number
  /** Les gains des 30 derniers jours, par type. */
  gains30d: { kind: SapKind; count: number; amount: number }[]
  /** Comptes par nombre de cernes formés (0, 1, 2…). */
  rings: { rings: number; accounts: number }[]
  /** Gestes notés et comptes actifs, par semaine — le rapport est ce qui compte. */
  gesturesByWeek: RatioWeekPoint[]
  /** Gestes par actif et par semaine, sur les quatre semaines avant et depuis le lancement. */
  gesturesPerActive: { before: number | null; after: number | null }
  secretTrialsByWeek: WeekPoint[]
  secretFeedbacks: number
  listingsDoneByWeek: WeekPoint[]
  giftsByWeek: WeekPoint[]
  giftGivers: number
  /** Rétention J30 des cohortes inscrites avant et depuis le lancement, mûres seulement. */
  j30: { before: { cohort: number; retained: number }; after: { cohort: number; retained: number } }
  quartier: { week: string; slug: string; participants: number; reached: number }[]
  themes: { theme: SapHomeTheme | 'classique'; accounts: number }[]
}

function fill(weeks: string[], rows: { week: Date | string; count: number }[]): WeekPoint[] {
  const byWeek = new Map(
    rows.map((row) => [typeof row.week === 'string' ? row.week.slice(0, 10) : row.week.toISOString().slice(0, 10), Number(row.count)]),
  )
  return weeks.map((week) => ({ week, value: byWeek.get(week) ?? 0 }))
}

/** Comptes par nombre de cernes, de 0 au plus grand nombre atteint. */
export function ringDistribution(totals: number[]): SapStats['rings'] {
  const counts = new Map<number, number>()
  for (const total of totals) {
    const { count } = sapRings(total)
    counts.set(count, (counts.get(count) ?? 0) + 1)
  }
  const max = Math.max(0, ...counts.keys())
  return Array.from({ length: max + 1 }, (_, rings) => ({ rings, accounts: counts.get(rings) ?? 0 }))
}

/** Gestes par actif sur des semaines données ; `null` sans aucun actif. */
export function gesturesPerActive(points: RatioWeekPoint[]): number | null {
  const active = points.reduce((sum, point) => sum + point.active, 0)
  if (active === 0) return null
  const gestures = points.reduce((sum, point) => sum + point.gestures, 0)
  return Math.round((gestures / active) * 10) / 10
}

/** Les semaines entières avant le lancement, et celles depuis. */
export function splitAroundLaunch(
  points: RatioWeekPoint[],
  launchedAt: Date | null,
  weeks = COMPARE_WEEKS,
): { before: RatioWeekPoint[]; after: RatioWeekPoint[] } {
  if (!launchedAt) return { before: points.slice(-weeks), after: [] }
  const launchDay = launchedAt.toISOString().slice(0, 10)
  const startsAfter = (week: string) => {
    const end = new Date(`${week}T00:00:00Z`)
    end.setUTCDate(end.getUTCDate() + 7)
    return end.toISOString().slice(0, 10)
  }
  // Une semaine est « avant » si elle s'achève au plus tard le jour du
  // lancement, « après » si elle commence le jour même ou après : la semaine
  // du lancement, mixte, n'est comptée nulle part.
  const before = points.filter((point) => startsAfter(point.week) <= launchDay).slice(-weeks)
  const after = points.filter((point) => point.week >= launchDay).slice(0, weeks)
  return { before, after }
}

async function weekly(sql: Prisma.Sql): Promise<{ week: Date; count: number }[]> {
  return prisma.$queryRaw<{ week: Date; count: number }[]>(sql)
}

export async function sapStats(now: Date = new Date()): Promise<SapStats> {
  const weeks = lastWeeks(SAP_STATS_WEEKS, now)
  const since = new Date(`${weeks[0]}T00:00:00.000Z`)
  const since30 = new Date(now.getTime() - 30 * DAY_MS)

  // ─── Le journal de la sève
  const [launch, totals, gains] = await Promise.all([
    prisma.sapEntry.findFirst({ orderBy: { createdAt: 'asc' }, select: { createdAt: true } }),
    prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
      SELECT SUM(amount)::int AS total FROM sap_entries GROUP BY "userId"
    `),
    prisma.sapEntry.groupBy({
      by: ['kind'],
      where: { createdAt: { gte: since30 } },
      _count: { _all: true },
      _sum: { amount: true },
    }),
  ])
  const launchedAt = launch?.createdAt ?? null

  // ─── L'usage, semaine par semaine
  const [gestureRows, activeRows, trialRows] = await Promise.all([
    weekly(Prisma.sql`
      SELECT date_trunc('week', "occurredAt" AT TIME ZONE 'UTC')::date AS week, COUNT(*)::int AS count
      FROM care_logs
      WHERE "occurredAt" >= ${since} AND type <> 'health'
      GROUP BY 1 ORDER BY 1
    `),
    weekly(Prisma.sql`
      SELECT date_trunc('week', day::date)::date AS week, COUNT(DISTINCT "userId")::int AS count
      FROM user_activities
      WHERE day >= ${weeks[0]}
      GROUP BY 1 ORDER BY 1
    `),
    weekly(Prisma.sql`
      SELECT date_trunc('week', "occurredAt" AT TIME ZONE 'UTC')::date AS week, COUNT(*)::int AS count
      FROM care_logs
      WHERE "occurredAt" >= ${since} AND "ruleId" = ${SECRET_RULE_IDS.discover} AND "tipSlug" IS NOT NULL
      GROUP BY 1 ORDER BY 1
    `),
  ])

  const [listingRows, giftRows, giftGivers, secretFeedbacks] = await Promise.all([
    // Une annonce terminée n'a pas de date de clôture : `updatedAt` en tient
    // lieu, et une retouche ultérieure la décalerait — c'est rare.
    weekly(Prisma.sql`
      SELECT date_trunc('week', "updatedAt" AT TIME ZONE 'UTC')::date AS week, COUNT(*)::int AS count
      FROM listings
      WHERE status = 'done' AND "updatedAt" >= ${since}
      GROUP BY 1 ORDER BY 1
    `),
    weekly(Prisma.sql`
      SELECT date_trunc('week', "createdAt" AT TIME ZONE 'UTC')::date AS week, COUNT(*)::int AS count
      FROM sap_gifts
      WHERE "createdAt" >= ${since}
      GROUP BY 1 ORDER BY 1
    `),
    prisma.$queryRaw<{ count: number }[]>(Prisma.sql`SELECT COUNT(DISTINCT "fromUserId")::int AS count FROM sap_gifts`),
    prisma.sapEntry.count({ where: { kind: 'secret_feedback' } }),
  ])

  // ─── Rétention J30, avant et depuis le lancement
  const j30 = await j30Retention(launchedAt, now)

  // ─── Quartier et thèmes
  const [weeksClosed, themeRows] = await Promise.all([
    // Le quartier a sa propre migration : sans elle, la section se montre sans lui.
    prisma.quartierWeek
      .findMany({
        where: { closedAt: { not: null } },
        orderBy: { week: 'desc' },
        take: 8,
        select: { week: true, slug: true },
      })
      .catch(() => [] as { week: string; slug: string }[]),
    prisma.user.groupBy({ by: ['homeTheme'], _count: { _all: true } }),
  ])
  const results = weeksClosed.length
    ? await prisma.quartierResult.findMany({
        where: { week: { in: weeksClosed.map((row) => row.week) } },
        select: { week: true, contributed: true, reached: true },
      })
    : []

  const gestures = fill(weeks, gestureRows)
  const active = fill(weeks, activeRows)
  const gesturesByWeek = weeks.map((week, index) => ({
    week,
    gestures: gestures[index].value,
    active: active[index].value,
  }))
  const split = splitAroundLaunch(gesturesByWeek, launchedAt)

  return {
    launchedAt: launchedAt?.toISOString() ?? null,
    accountsWithSap: totals.length,
    totalSap: totals.reduce((sum, row) => sum + Number(row.total), 0),
    gains30d: SAP_KINDS.map((kind) => {
      const row = gains.find((gain) => gain.kind === kind)
      return { kind, count: row?._count._all ?? 0, amount: row?._sum.amount ?? 0 }
    }).filter((gain) => gain.count > 0),
    rings: ringDistribution(totals.map((row) => Number(row.total))),
    gesturesByWeek,
    gesturesPerActive: { before: gesturesPerActive(split.before), after: gesturesPerActive(split.after) },
    secretTrialsByWeek: fill(weeks, trialRows),
    secretFeedbacks,
    listingsDoneByWeek: fill(weeks, listingRows),
    giftsByWeek: fill(weeks, giftRows),
    giftGivers: giftGivers[0]?.count ?? 0,
    j30,
    quartier: weeksClosed
      .map((row) => {
        const ofWeek = results.filter((result) => result.week === row.week)
        return {
          week: row.week,
          slug: row.slug,
          participants: ofWeek.filter((result) => result.contributed > 0).length,
          reached: ofWeek.filter((result) => result.reached).length,
        }
      })
      .reverse(),
    themes: [
      { theme: 'classique' as const, accounts: themeRows.find((row) => row.homeTheme === null)?._count._all ?? 0 },
      ...SAP_HOME_THEMES.map((theme) => ({
        theme,
        accounts: themeRows.find((row) => row.homeTheme === theme)?._count._all ?? 0,
      })),
    ],
  }
}

/**
 * Part des comptes revus entre J28 et J35, pour les inscrits des douze
 * semaines avant le lancement et ceux d'après. **Seules les cohortes mûres**
 * comptent — inscrites il y a plus de 35 jours —, sans quoi la mesure
 * d'après plongerait faute de recul.
 */
async function j30Retention(launchedAt: Date | null, now: Date): Promise<SapStats['j30']> {
  const empty = { cohort: 0, retained: 0 }
  if (!launchedAt) return { before: empty, after: empty }
  const matureBefore = new Date(now.getTime() - J30_TO_DAYS * DAY_MS)
  const windowStart = new Date(launchedAt.getTime() - 12 * 7 * DAY_MS)

  const rows = await prisma.$queryRaw<{ period: string; cohort: number; retained: number }[]>(Prisma.sql`
    SELECT CASE WHEN u."createdAt" < ${launchedAt} THEN 'before' ELSE 'after' END AS period,
           COUNT(*)::int AS cohort,
           COUNT(*) FILTER (
             WHERE EXISTS (
               SELECT 1 FROM user_activities a
               WHERE a."userId" = u.id
                 AND a.day::date >= (u."createdAt" AT TIME ZONE 'UTC')::date + ${J30_FROM_DAYS}::int
                 AND a.day::date < (u."createdAt" AT TIME ZONE 'UTC')::date + ${J30_TO_DAYS}::int
             )
           )::int AS retained
    FROM users u
    WHERE u."createdAt" >= ${windowStart} AND u."createdAt" < ${matureBefore}
    GROUP BY 1
  `)
  const pick = (period: string) => {
    const row = rows.find((candidate) => candidate.period === period)
    return row ? { cohort: Number(row.cohort), retained: Number(row.retained) } : empty
  }
  return { before: pick('before'), after: pick('after') }
}

/**
 * La section, mise en cache comme le reste du tableau de bord. Elle vit à
 * part de `getAdminStats` : une panne ici — table absente, requête qui
 * expire — ne doit pas emporter les autres sections. `null` dit « indisponible ».
 */
export const getAdminSapStats = unstable_cache(
  async (): Promise<SapStats | null> => {
    try {
      return await sapStats()
    } catch (error) {
      console.error('[admin] statistiques de la sève indisponibles :', error)
      return null
    }
  },
  ['admin-sap-stats'],
  { revalidate: STATS_CACHE_SECONDS, tags: ['admin-stats'] },
)
