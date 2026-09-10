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

// ─── Communauté ────────────────────────────────────────────────────────────

/**
 * Les indicateurs de la communauté.
 *
 * Les proportions sont exposées en **numérateur et dénominateur**, jamais en
 * ratio : la page les met en forme avec son helper `pct`, et un dénominateur
 * nommé à l'écran évite de lire « 40 % » comme une tendance quand il porte sur
 * trois publications.
 */
export type CommunityStats = {
  enabledProfiles: number
  posts: number
  postsByWeek: WeekPoint[]
  /**
   * Publications ayant reçu au moins un cœur ou un commentaire dans les 48
   * heures, et publications **assez vieilles pour être jugées**.
   *
   * Inclure celle d'il y a une heure ferait plonger le taux pour une raison
   * étrangère au produit — même écueil que les cohortes de rétention.
   */
  engagedPosts: number
  judgedPosts: number
  activeListings: number
  /** Annonces terminées, et annonces closes d'une façon ou d'une autre. */
  doneListings: number
  closedListings: number
  threads: number
  /** Annonces ayant pu recevoir un fil — le dénominateur de la moyenne. */
  openableListings: number
  openReports: number
  reports: number
  /** Contenus publiés, toutes natures confondues : la base du taux pour mille. */
  publishedContents: number
}

async function communityStats(now: Date): Promise<CommunityStats> {
  const weeks = lastWeeks(SIGNUP_WEEKS, now)
  const since = new Date(`${weeks[0]}T00:00:00.000Z`)

  // Les publications de plus de 48 heures : les seules dont on puisse dire si
  // elles ont trouvé leur public.
  const judgedBefore = new Date(now.getTime() - 48 * 3_600_000)

  /*
   * Deux groupes, et non un seul de douze : c'est la section la plus large du
   * tableau de bord, et celle qui expirait en premier sur un pool d'une seule
   * connexion (la pile de l'erreur pointait `prisma.post.count()`). Voir
   * `computeStats` pour le raisonnement complet.
   */
  const [enabledProfiles, posts, postRows, engaged, judged] = await Promise.all([
    prisma.user.count({ where: { communityEnabled: true, disabledAt: null } }),
    prisma.post.count({ where: { status: { not: 'deleted' } } }),
    prisma.$queryRaw<{ week: Date; count: number }[]>(Prisma.sql`
      SELECT date_trunc('week', "createdAt" AT TIME ZONE 'UTC')::date AS week,
             COUNT(*)::int AS count
      FROM posts
      WHERE "createdAt" >= ${since} AND status <> 'deleted'
      GROUP BY 1
      ORDER BY 1
    `),
    // Une réaction **dans les 48 heures** : un cœur reçu six mois plus tard ne
    // dit rien de la vitalité du fil au moment où la photo a été postée.
    prisma.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT p.id)::int AS count
      FROM posts p
      WHERE p.status <> 'deleted'
        AND p."createdAt" <= ${judgedBefore}
        AND (
          EXISTS (
            SELECT 1 FROM post_likes l
            WHERE l."postId" = p.id
              AND l."createdAt" <= p."createdAt" + interval '48 hours'
          )
          OR EXISTS (
            SELECT 1 FROM comments c
            WHERE c."postId" = p.id
              AND c."createdAt" <= p."createdAt" + interval '48 hours'
          )
        )
    `),
    prisma.post.count({
      where: { status: { not: 'deleted' }, createdAt: { lte: judgedBefore } },
    }),
  ])

  const [
    activeListings,
    doneListings,
    closedListings,
    threads,
    listingsWithThreads,
    openReports,
    reports,
  ] = await Promise.all([
    prisma.listing.count({ where: { status: { in: ['active', 'reserved'] } } }),
    prisma.listing.count({ where: { status: 'done' } }),
    prisma.listing.count({ where: { status: { in: ['done', 'expired'] } } }),
    prisma.listingThread.count(),
    // Le dénominateur des fils par annonce : les annonces qui ont **pu** en
    // recevoir, c'est-à-dire toutes sauf les supprimées.
    prisma.listing.count({ where: { status: { not: 'deleted' } } }),
    prisma.report.count({ where: { status: 'open' } }),
    prisma.report.count(),
  ])

  return {
    enabledProfiles,
    posts,
    postsByWeek: fillWeeks(weeks, postRows),
    engagedPosts: engaged[0]?.count ?? 0,
    judgedPosts: judged,
    activeListings,
    doneListings,
    closedListings,
    threads,
    openableListings: listingsWithThreads,
    openReports,
    reports,
    // Publications et annonces : c'est sur elles que se rapporte le taux de
    // signalement, et non sur les commentaires, qu'on ne « publie » pas.
    publishedContents: posts + listingsWithThreads,
  }
}

// ─── Assemblage ────────────────────────────────────────────────────────────

export type AdminStats = {
  accounts: AccountStats
  active: ActiveStats
  retention: RetentionPoint[]
  garden: GardenStats
  ai: AiStats
  community: CommunityStats
  ops: OpsStats
  generatedAt: string
}

/** Sans cache — c'est cette fonction que les tests appellent. */
export async function computeStats(now: Date = new Date()): Promise<AdminStats> {
  /*
   * **Les sections s'exécutent l'une après l'autre**, et ce n'est pas un
   * oubli de `Promise.all`.
   *
   * Lancées ensemble, les sept sections mettaient une trentaine de requêtes en
   * vol simultanément. Le pool de connexions de Prisma vaut 1 en production
   * (`connection_limit=1` dans `DATABASE_URL`, pooler transactionnel Supabase) :
   * les requêtes s'y empilaient derrière une seule connexion, et celles qui
   * attendaient encore au bout de dix secondes abandonnaient — `P2024`, page
   * blanche, « Application error » sans plus d'explication.
   *
   * Le parallélisme n'achetait rien : avec une connexion, tout est de toute
   * façon sérialisé côté base. Il ne créait qu'une file d'attente capable
   * d'expirer. La page est mise en cache dix minutes juste en dessous, un
   * rendu à froid un peu plus lent ne se voit pas.
   */
  const accounts = await accountStats(now)
  const active = await activeStats(now)
  const retentionPoints = await retention(now)
  const garden = await gardenStats(now)
  const ai = await aiStats(now)
  const community = await communityStats(now)
  const ops = await opsStats()

  return {
    accounts,
    active,
    retention: retentionPoints,
    garden,
    ai,
    community,
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
