/**
 * La sève du quartier (phase 7 du plan `~/Growi/Documentation/spec/17-plan-seve.md`).
 *
 * Un défi coopératif par semaine, ce qui a circulé entre voisins, les Secrets
 * qui marchent ici et les mercis de la semaine. Décisions du 06/11/2026 —
 * voir `constants/quartier.ts` dans `@growi/shared`.
 *
 * Le quartier n'est **pas une zone fixe** : c'est le rayon Communauté de
 * chacun, élargi jusqu'à compter `QUARTIER_MIN_GARDENERS` profils publics.
 * Deux voisins ne voient donc pas tout à fait le même quartier, et c'est
 * voulu : il n'y a ni frontière à tracer, ni classement entre zones.
 *
 * ⚠️ Les distances sont calculées **en mémoire**, sur la liste des profils
 * publics localisés : simple, testable, et sans coût à l'échelle des premiers
 * milliers de comptes. La clôture fait ce calcul pour chaque compte (n²) ; au-
 * delà de quelques milliers de profils, passer au SQL `earth_box` du fil.
 */

import {
  QUARTIER_CIRCULATION_DAYS,
  QUARTIER_MIN_GARDENERS,
  QUARTIER_PARTICIPATION_SAP,
  QUARTIER_RADIUS_STEPS,
  QUARTIER_SECRET_MIN_VERDICTS,
  QUARTIER_SECRETS_DAYS,
  QUARTIER_SUCCESS_SAP,
  SECRET_RULE_IDS,
  pickQuartierChallenge,
  quartierChallenge,
  quartierTarget,
  quartierTitle,
  quartierUnit,
  type Quartier,
  type QuartierChallengeDef,
  type QuartierMetric,
} from '@growi/shared'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { isoWeekBounds, isoWeekKey } from '@/lib/secrets/select'
import { distanceKm } from '@/lib/services/community/geo'
import { ServiceError } from '@/lib/services/errors'
import { awardSap } from '@/lib/services/sap.service'
import { revealRewardSecret, secretTitles } from '@/lib/services/secrets.service'
import { startOfZonedDay, zonedDayIso } from '@/lib/zoned-day'

/** Les semaines du défi se comptent à l'heure de Paris : un seul défi pour tous. */
const CHALLENGE_TIME_ZONE = 'Europe/Paris'
const DAY_MS = 86_400_000
const SHOWN_INITIALS = 4
const SHOWN_SECRETS = 3
const SHOWN_THANKS = 10

// ─── Semaines ──────────────────────────────────────────────────────────────

export interface ChallengeWeek {
  week: string
  start: Date
  end: Date
  /** Le mois du jeudi de la semaine ISO, qui en fixe la saison. */
  month: number
}

function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Minuit, heure de Paris, d'un jour `YYYY-MM-DD`. */
function parisMidnight(day: string): Date {
  return startOfZonedDay(new Date(`${day}T12:00:00Z`), CHALLENGE_TIME_ZONE)
}

/** La semaine du défi qui contient `now`, ou celle d'avant avec `offsetWeeks: -1`. */
export function challengeWeek(now: Date, offsetWeeks = 0): ChallengeWeek {
  const day = addDays(zonedDayIso(now, CHALLENGE_TIME_ZONE), offsetWeeks * 7)
  const { start } = isoWeekBounds(day)
  return {
    week: isoWeekKey(day),
    start: parisMidnight(start),
    end: parisMidnight(addDays(start, 7)),
    month: Number(addDays(start, 3).slice(5, 7)),
  }
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

/**
 * Le défi de la semaine, tiré puis **figé** au premier calcul : une retouche
 * de la bibliothèque ne change pas un défi en cours. Jamais celui de la
 * semaine précédente.
 */
async function weekChallenge(week: ChallengeWeek): Promise<QuartierChallengeDef> {
  const existing = await prisma.quartierWeek.findUnique({ where: { week: week.week } })
  const frozen = existing ? quartierChallenge(existing.slug) : undefined
  if (frozen) return frozen

  const previous = await prisma.quartierWeek.findUnique({
    where: { week: challengeWeek(new Date(week.start.getTime() + DAY_MS), -1).week },
    select: { slug: true },
  })
  const picked = pickQuartierChallenge(week.week, week.month, previous?.slug ?? null)

  if (!existing) {
    try {
      await prisma.quartierWeek.create({ data: { week: week.week, slug: picked.slug } })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      // Une lecture simultanée l'a figé avant nous : c'est le sien qui vaut.
      const winner = await prisma.quartierWeek.findUnique({ where: { week: week.week } })
      return (winner && quartierChallenge(winner.slug)) || picked
    }
  }
  return picked
}

// ─── Le quartier ───────────────────────────────────────────────────────────

export interface Member {
  id: string
  handle: string | null
  fuzzyLat: number | null
  fuzzyLng: number | null
  communityRadiusKm: number
}

/** Les profils publics, ceux qui comptent dans un quartier (décision du 06/11/2026). */
async function communityMembers(): Promise<Member[]> {
  return prisma.user.findMany({
    where: { communityEnabled: true, disabledAt: null },
    select: { id: true, handle: true, fuzzyLat: true, fuzzyLng: true, communityRadiusKm: true },
  })
}

export interface ResolvedQuartier {
  /** `null` : toute la France. */
  radiusKm: number | null
  members: Member[]
}

/**
 * Le quartier d'un compte : son rayon, puis les paliers suivants tant qu'il y
 * a moins de `QUARTIER_MIN_GARDENERS` profils publics, puis toute la France.
 * Un compte sans position est rattaché d'emblée à toute la France.
 */
export function resolveQuartier(viewer: Member, members: Member[]): ResolvedQuartier {
  const located = members.filter((member) => member.fuzzyLat !== null && member.fuzzyLng !== null)
  if (viewer.fuzzyLat === null || viewer.fuzzyLng === null) return { radiusKm: null, members }

  const origin = { lat: viewer.fuzzyLat, lng: viewer.fuzzyLng }
  const distances = located.map((member) => ({
    member,
    km: member.id === viewer.id ? 0 : distanceKm(origin, { lat: member.fuzzyLat!, lng: member.fuzzyLng! }),
  }))

  const radii = [viewer.communityRadiusKm, ...QUARTIER_RADIUS_STEPS.filter((step) => step > viewer.communityRadiusKm)]
  for (const radius of radii) {
    const inside = distances.filter((entry) => entry.km <= radius).map((entry) => entry.member)
    if (inside.length >= QUARTIER_MIN_GARDENERS) return { radiusKm: radius, members: inside }
  }
  return { radiusKm: null, members }
}

// ─── Ce que compte un défi ─────────────────────────────────────────────────

/** Les contributions de chaque compte sur la période, au journal. */
export async function countContributions(
  metric: QuartierMetric,
  userIds: string[],
  from: Date,
  to: Date,
): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  if (userIds.length === 0) return counts
  const add = (userId: string) => counts.set(userId, (counts.get(userId) ?? 0) + 1)
  const period = { gte: from, lt: to }

  switch (metric.kind) {
    case 'care': {
      const or: Prisma.CareLogWhereInput[] = []
      if (metric.types?.length) or.push({ type: { in: metric.types } })
      if (metric.ruleIds?.length) or.push({ ruleId: { in: metric.ruleIds } })
      // Un « autre geste » noté depuis la fiche ne porte pas de règle : on le
      // reconnaît à son nom (« Paillage », « Voile d'hivernage »).
      for (const word of metric.noteIncludes ?? []) {
        or.push({ type: 'other', note: { contains: word, mode: 'insensitive' } })
      }
      const rows = await prisma.careLog.findMany({
        where: { plantInstance: { userId: { in: userIds } }, occurredAt: period, OR: or },
        select: { plantInstance: { select: { userId: true } } },
      })
      for (const row of rows) add(row.plantInstance.userId)
      break
    }
    case 'secret_trial': {
      const rows = await prisma.careLog.findMany({
        where: {
          plantInstance: { userId: { in: userIds } },
          occurredAt: period,
          ruleId: SECRET_RULE_IDS.discover,
          tipSlug: { not: null },
        },
        select: { plantInstance: { select: { userId: true } } },
      })
      for (const row of rows) add(row.plantInstance.userId)
      break
    }
    case 'post': {
      const rows = await prisma.post.findMany({
        where: { userId: { in: userIds }, createdAt: period, status: { not: 'deleted' } },
        select: { userId: true },
      })
      for (const row of rows) add(row.userId)
      break
    }
    case 'gift': {
      const rows = await prisma.sapGift.findMany({
        where: { fromUserId: { in: userIds }, createdAt: period },
        select: { fromUserId: true },
      })
      for (const row of rows) add(row.fromUserId)
      break
    }
    case 'listing_done': {
      // Le journal de la sève dit quand une annonce a été menée à bien — et
      // seulement si un voisin s'y était intéressé.
      const rows = await prisma.sapEntry.findMany({
        where: { userId: { in: userIds }, kind: 'listing_done', createdAt: period },
        select: { userId: true },
      })
      for (const row of rows) add(row.userId)
      break
    }
  }
  return counts
}

function sum(counts: Map<string, number>, members: Member[]): number {
  return members.reduce((total, member) => total + (counts.get(member.id) ?? 0), 0)
}

// ─── Lecture ───────────────────────────────────────────────────────────────

/**
 * Le quartier d'un compte, tel que le montrent l'écran « Ton quartier » de
 * l'app et la page web.
 *
 * @throws ServiceError('FORBIDDEN') sans profil public : n'y comptent, et n'y
 *   lisent, que ceux qui ont rejoint la Communauté.
 */
export async function getQuartier(userId: string, now: Date = new Date()): Promise<Quartier> {
  const members = await communityMembers()
  const viewer = members.find((member) => member.id === userId)
  if (!viewer) {
    throw new ServiceError('FORBIDDEN', 'Active ton profil public pour voir ton quartier.')
  }

  const quartier = resolveQuartier(viewer, members)
  const ids = quartier.members.map((member) => member.id)
  const week = challengeWeek(now)
  const since = new Date(now.getTime() - QUARTIER_CIRCULATION_DAYS * DAY_MS)

  const [challenge, exchanges, gifts, trials, secrets, thanks] = await Promise.all([
    // Sans défi lisible (migration `20261106160000_quartier` absente, base qui
    // bronche), le reste du quartier s'affiche quand même.
    challengeView(week, quartier, viewer, now).catch((error) => {
      console.error('[quartier] défi illisible :', error)
      return null
    }),
    prisma.sapEntry.count({ where: { userId: { in: ids }, kind: 'listing_done', createdAt: { gte: since } } }),
    prisma.sapGift.count({ where: { fromUserId: { in: ids }, createdAt: { gte: since } } }),
    prisma.careLog.count({
      where: {
        plantInstance: { userId: { in: ids } },
        ruleId: SECRET_RULE_IDS.discover,
        tipSlug: { not: null },
        occurredAt: { gte: since },
      },
    }),
    secretsThatWork(ids, now),
    thanksOfTheWeek(userId, ids, week),
  ])

  return {
    radiusKm: quartier.radiusKm,
    chosenRadiusKm: viewer.communityRadiusKm,
    gardeners: quartier.members.length,
    challenge,
    circulation: { days: QUARTIER_CIRCULATION_DAYS, exchanges, gifts, secretsTried: trials },
    secrets,
    thanks,
  }
}

async function challengeView(
  week: ChallengeWeek,
  quartier: ResolvedQuartier,
  viewer: Member,
  now: Date,
): Promise<Quartier['challenge']> {
  const def = await weekChallenge(week)
  const counts = await countContributions(
    def.metric,
    quartier.members.map((member) => member.id),
    week.start,
    week.end,
  )
  const progress = sum(counts, quartier.members)
  const target = quartierTarget(def, quartier.members.length)
  const participants = quartier.members
    .filter((member) => (counts.get(member.id) ?? 0) > 0)
    .sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || a.id.localeCompare(b.id))

  return {
    slug: def.slug,
    week: week.week,
    title: quartierTitle(def, target),
    unitLabel: quartierUnit(def, progress),
    target,
    progress,
    participants: participants.length,
    // Des initiales seulement : on voit qu'on n'est pas seul, pas qui a fait quoi.
    participantInitials: participants
      .slice(0, SHOWN_INITIALS)
      .map((member) => (member.handle ?? '?').charAt(0).toUpperCase()),
    mine: counts.get(viewer.id) ?? 0,
    endsAt: week.end.toISOString(),
    daysLeft: Math.max(0, Math.ceil((week.end.getTime() - now.getTime()) / DAY_MS)),
    reached: progress >= target,
    participationSap: QUARTIER_PARTICIPATION_SAP,
    successSap: QUARTIER_SUCCESS_SAP,
    action: def.action,
  }
}

/**
 * Les Secrets qui marchent dans le quartier, d'après les retours des voisins.
 * Un secret n'est cité qu'à partir de `QUARTIER_SECRET_MIN_VERDICTS` retours :
 * en dessous, le chiffre désignerait quelqu'un.
 */
async function secretsThatWork(ids: string[], now: Date): Promise<Quartier['secrets']> {
  const rows = await prisma.careLog.findMany({
    where: {
      plantInstance: { userId: { in: ids } },
      ruleId: SECRET_RULE_IDS.discover,
      tipSlug: { not: null },
      tipVerdict: { not: null },
      occurredAt: { gte: new Date(now.getTime() - QUARTIER_SECRETS_DAYS * DAY_MS) },
    },
    select: { tipSlug: true, tipVerdict: true },
  })

  const bySlug = new Map<string, { worked: number; total: number }>()
  for (const row of rows) {
    if (!row.tipSlug) continue
    const entry = bySlug.get(row.tipSlug) ?? { worked: 0, total: 0 }
    entry.total++
    if (row.tipVerdict === 'WORKED') entry.worked++
    bySlug.set(row.tipSlug, entry)
  }

  const eligible = [...bySlug.entries()].filter(([, entry]) => entry.total >= QUARTIER_SECRET_MIN_VERDICTS)
  if (eligible.length === 0) return []
  const titles = await secretTitles(eligible.map(([slug]) => slug))

  return eligible
    .flatMap(([slug, entry]) => {
      const title = titles.get(slug)
      return title ? [{ slug, title, ...entry }] : []
    })
    .sort((a, b) => b.worked / b.total - a.worked / a.total || b.total - a.total)
    .slice(0, SHOWN_SECRETS)
}

/**
 * Les mercis de la semaine : **nommés pour ceux qui les ont offerts ou
 * reçus**, en nombre seulement pour le reste du quartier — une goutte est un
 * merci privé (décision du 06/11/2026).
 */
async function thanksOfTheWeek(userId: string, ids: string[], week: ChallengeWeek): Promise<Quartier['thanks']> {
  const period = { gte: week.start, lt: week.end }
  const [weekCount, mine] = await Promise.all([
    prisma.sapGift.count({ where: { fromUserId: { in: ids }, createdAt: period } }),
    prisma.sapGift.findMany({
      where: { createdAt: period, OR: [{ fromUserId: userId }, { toUserId: userId }] },
      orderBy: { createdAt: 'desc' },
      take: SHOWN_THANKS,
      select: {
        fromUserId: true,
        reason: true,
        message: true,
        createdAt: true,
        from: { select: { handle: true } },
        to: { select: { handle: true } },
      },
    }),
  ])

  return {
    weekCount,
    mine: mine.map((gift) => {
      const received = gift.fromUserId !== userId
      return {
        direction: received ? ('received' as const) : ('sent' as const),
        handle: (received ? gift.from.handle : gift.to.handle) ?? 'un voisin',
        reason: gift.reason,
        // Le mot n'est montré qu'à ces deux-là : c'est ici le cas.
        message: gift.message,
        createdAt: gift.createdAt.toISOString(),
      }
    }),
  }
}

// ─── Clôture ───────────────────────────────────────────────────────────────

export interface QuartierClosure {
  week: string | null
  participants: number
  reached: number
}

/**
 * Clôt le défi de la semaine passée — appelée chaque matin par la tournée
 * (`daily-reminders`), elle n'agit qu'une fois par semaine.
 *
 * Pour chaque profil public, son quartier est recalculé comme à la lecture :
 * - avoir contribué rapporte `QUARTIER_PARTICIPATION_SAP`, réussite ou non ;
 * - un défi réussi rapporte en plus `QUARTIER_SUCCESS_SAP` aux participants,
 *   et fait découvrir un Secret inédit à **tout** le quartier (maquette 5).
 *
 * Rejouable : `quartier_results (userId, week)` est unique, une ligne déjà
 * écrite n'est pas redistribuée, et la sève est elle-même idempotente par
 * semaine. `closedAt` n'est posé qu'à la fin : une clôture interrompue
 * reprend le lendemain là où elle s'était arrêtée.
 */
export async function closeQuartierWeek(now: Date = new Date()): Promise<QuartierClosure> {
  const week = challengeWeek(now, -1)
  const row = await prisma.quartierWeek.findUnique({ where: { week: week.week } })
  // Personne n'a ouvert le défi de cette semaine-là : il n'a jamais existé.
  if (!row || row.closedAt) return { week: null, participants: 0, reached: 0 }

  const def = quartierChallenge(row.slug)
  if (!def) {
    await prisma.quartierWeek.update({ where: { week: week.week }, data: { closedAt: now } })
    return { week: week.week, participants: 0, reached: 0 }
  }

  const members = await communityMembers()
  const counts = await countContributions(
    def.metric,
    members.map((member) => member.id),
    week.start,
    week.end,
  )

  let participants = 0
  let reachedCount = 0
  for (const member of members) {
    const quartier = resolveQuartier(member, members)
    const progress = sum(counts, quartier.members)
    const target = quartierTarget(def, quartier.members.length)
    const reached = progress >= target
    const contributed = counts.get(member.id) ?? 0
    if (contributed === 0 && !reached) continue

    let resultId: string
    try {
      const result = await prisma.quartierResult.create({
        data: { userId: member.id, week: week.week, slug: def.slug, contributed, progress, target, reached },
      })
      resultId = result.id
    } catch (error) {
      if (isUniqueViolation(error)) continue
      throw error
    }

    const title = quartierTitle(def, target)
    if (contributed > 0) {
      participants++
      await awardSap(member.id, {
        kind: 'challenge_participation',
        sourceId: week.week,
        label: `Ta part au défi « ${title} »`,
        at: now,
      })
    }
    if (reached) {
      reachedCount++
      if (contributed > 0) {
        await awardSap(member.id, {
          kind: 'challenge_success',
          sourceId: week.week,
          label: `Défi « ${title} » réussi ensemble`,
          at: now,
        })
      }
      const slug = await revealRewardSecret(member.id, `quartier:${week.week}`)
      if (slug) await prisma.quartierResult.update({ where: { id: resultId }, data: { secretSlug: slug } })
    }
  }

  await prisma.quartierWeek.update({ where: { week: week.week }, data: { closedAt: now } })
  return { week: week.week, participants, reached: reachedCount }
}
