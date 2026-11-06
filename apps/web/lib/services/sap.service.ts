/**
 * La Sève — ce que rapportent les gestes utiles au jardin et aux autres.
 *
 * Plan : `~/Growi/Documentation/spec/17-plan-seve.md`. Le barème, les
 * plafonds et les cernes vivent dans `@growi/shared` (`constants/sap.ts`) :
 * ce service ne fait que les appliquer.
 *
 * Deux familles de fonctions, deux contrats :
 *
 * - **Créditer** (`awardSap`, `awardSapMany`, `revokeSap`) ne lève **jamais**.
 *   La sève est un agrément, comme une notification : échouer à l'écrire ne
 *   doit pas faire échouer l'arrosage qui l'a rapportée. Les appelants ne
 *   l'attendent pas non plus d'ailleurs — voir `awardSapLater`.
 * - **Lire et offrir** (`getSapSummary`, `listSapHistory`, `giveSapDrop`)
 *   sont des gestes de l'utilisateur et lèvent des `ServiceError` comme les
 *   autres services.
 */

import {
  BLOCKED_TERM_MESSAGE,
  CARE_LOG_TYPE_LABELS,
  SAP_GIFT_REASON_PHRASES,
  SAP_GIFTS_PER_WEEK,
  SAP_RULES,
  findBlockedTerm,
  sapRings,
  type CareLogType,
  type GiveSapDropInput,
  type GiveSapDropResult,
  type SapKind,
} from '@growi/shared'
import { Prisma, type SapEntry } from '@prisma/client'
import { waitUntil } from '@vercel/functions'

import { trackServer } from '@/lib/analytics/server'
import { prisma } from '@/lib/prisma'
import { isoWeekKey } from '@/lib/secrets/select'
import { decodeCursor, takePage } from '@/lib/services/community/cursor'
import { ServiceError } from '@/lib/services/errors'
import { zonedDayIso } from '@/lib/zoned-day'

/** Nombre de gains rendus par le résumé — la carte de l'Accueil en montre un. */
const SUMMARY_RECENT_COUNT = 5
const HISTORY_PAGE_SIZE = 20

// ─── Créditer ──────────────────────────────────────────────────────────────

/**
 * Le fuseau du compte, lu ici plutôt que par `user.service` : ce service est
 * appelé depuis la Communauté, et importer celui des comptes (bcrypt, stockage,
 * profils) pour une seule colonne ferait un détour — et bientôt un cycle.
 */
async function userTimeZone(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } })
  return user?.timezone ?? 'Europe/Paris'
}

export interface SapAward {
  kind: SapKind
  /**
   * Ce qui a rapporté (id du CareLog, de la tâche, de la publication…). C'est
   * la clé d'idempotence : le même `(kind, sourceId)` ne crédite qu'une fois.
   */
  sourceId: string
  /** Libellé figé pour l'historique (« Rosiers paillés à temps »). */
  label?: string | null
  /** Instant du geste — par défaut maintenant. Décide du jour du plafond. */
  at?: Date
}

/** Vrai pour une violation d'unicité — le gain existe déjà. */
function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002'
}

/**
 * Combien de gains de ce type le compte peut encore recevoir ce jour-là.
 * `Infinity` quand le type n'a pas de plafond.
 */
async function remainingToday(userId: string, kind: SapKind, day: string): Promise<number> {
  const cap = SAP_RULES[kind].dailyCap
  if (cap === null) return Number.POSITIVE_INFINITY

  const used = await prisma.sapEntry.count({ where: { userId, kind, day } })
  return Math.max(0, cap - used)
}

/**
 * Crédite un gain. Rend la sève réellement gagnée : 0 si le geste est
 * plafonné, déjà crédité, ou si quoi que ce soit a échoué.
 *
 * Le plafond est lu puis écrit sans verrou : deux gains simultanés du même
 * type peuvent le dépasser d'une unité. C'est assumé — un arrosage de trop
 * compté ne vaut pas une transaction sérialisable à chaque geste.
 */
export async function awardSap(userId: string, award: SapAward): Promise<number> {
  try {
    const rule = SAP_RULES[award.kind]
    const timeZone = await userTimeZone(userId)
    const day = zonedDayIso(award.at ?? new Date(), timeZone)

    if ((await remainingToday(userId, award.kind, day)) <= 0) return 0

    await prisma.sapEntry.create({
      data: {
        userId,
        kind: award.kind,
        amount: rule.amount,
        sourceId: award.sourceId,
        day,
        label: award.label ?? null,
      },
    })

    trackServer(userId, 'sap_awarded', { kind: award.kind, amount: rule.amount })
    return rule.amount
  } catch (error) {
    if (!isUniqueViolation(error)) console.error('[sève] gain impossible :', error)
    return 0
  }
}

/**
 * Crédite plusieurs gains du même type d'un coup — la tournée « Tout arrosé ».
 *
 * Une seule lecture du plafond et une seule écriture : quinze arrosages ne
 * font pas quinze allers-retours vers la base. Au-delà du plafond, les gains
 * en trop sont simplement ignorés, dans l'ordre où ils arrivent. Un gain déjà
 * crédité (même `sourceId`) est sauté par `skipDuplicates` — il consomme
 * alors une place du plafond sans rien rapporter, ce qui reste sans
 * conséquence : il avait déjà été compté le jour où il a été crédité.
 */
export async function awardSapMany(
  userId: string,
  kind: SapKind,
  items: Array<{ sourceId: string; label?: string | null }>,
  at: Date = new Date(),
): Promise<number> {
  if (items.length === 0) return 0

  try {
    const rule = SAP_RULES[kind]
    const timeZone = await userTimeZone(userId)
    const day = zonedDayIso(at, timeZone)

    const room = await remainingToday(userId, kind, day)
    const kept = items.slice(0, Number.isFinite(room) ? room : items.length)
    if (kept.length === 0) return 0

    const { count } = await prisma.sapEntry.createMany({
      data: kept.map((item) => ({
        userId,
        kind,
        amount: rule.amount,
        sourceId: item.sourceId,
        day,
        label: item.label ?? null,
      })),
      skipDuplicates: true,
    })

    if (count > 0) trackServer(userId, 'sap_awarded', { kind, amount: count * rule.amount })
    return count * rule.amount
  } catch (error) {
    console.error('[sève] gains impossibles :', error)
    return 0
  }
}

/**
 * Reprend un gain — un arrosage effacé par « Annuler », une tâche rouverte.
 *
 * Sans cela, noter puis annuler en boucle ferait monter la sève sans aucun
 * geste réel. Silencieux s'il n'y avait rien à reprendre.
 */
export async function revokeSap(
  userId: string,
  kind: SapKind,
  sourceId: string | string[],
): Promise<void> {
  const sourceIds = Array.isArray(sourceId) ? sourceId : [sourceId]
  if (sourceIds.length === 0) return

  try {
    await prisma.sapEntry.deleteMany({ where: { userId, kind, sourceId: { in: sourceIds } } })
  } catch (error) {
    console.error('[sève] reprise impossible :', error)
  }
}

/**
 * Crédite les tâches du planning cochées **à temps** : au plus tard le jour
 * prévu, dans le jour de l'utilisateur. Une tâche en retard se coche sans
 * rien rapporter de plus que le geste lui-même — sans reproche non plus.
 *
 * L'appelant ne passe que les tâches qui **viennent** d'être cochées : une
 * tâche déjà faite, recochée, ne doit rien rapporter (l'unicité l'empêcherait
 * de toute façon).
 */
export async function awardTasksOnTime(
  userId: string,
  tasks: Array<{ id: string; dueDate: string; shortLabel?: string | null }>,
  now: Date = new Date(),
): Promise<number> {
  if (tasks.length === 0) return 0

  try {
    const today = zonedDayIso(now, await userTimeZone(userId))
    // `dueDate` et `today` sont deux `YYYY-MM-DD` : l'ordre lexical est l'ordre des jours.
    const onTime = tasks.filter((task) => task.dueDate >= today)

    return await awardSapMany(
      userId,
      'task_on_time',
      onTime.map((task) => ({
        sourceId: task.id,
        label: task.shortLabel ? `${task.shortLabel} à temps` : null,
      })),
      now,
    )
  } catch (error) {
    console.error('[sève] tâches à temps impossibles :', error)
    return 0
  }
}

/**
 * Le libellé d'un geste dans l'historique : le nom du geste, ou pour un
 * « autre geste » celui que le planning lui a donné (« Paillage », le titre
 * d'un Secret). Jamais la note libre de l'utilisateur, qui peut être longue.
 */
export function careSapLabel(type: CareLogType, gestureName?: string | null): string {
  return type === 'other' && gestureName ? gestureName : CARE_LOG_TYPE_LABELS[type]
}

/**
 * Crédite sans faire attendre l'appelant.
 *
 * `awardSap` ne lève pas, mais il fait trois requêtes : les ajouter au temps
 * de réponse d'un arrosage serait payer un agrément au prix fort. Vercel gèle
 * la fonction dès la réponse rendue ; `waitUntil` la garde en vie le temps
 * de l'écriture, comme pour les événements analytics.
 */
export function awardSapLater(userId: string, award: SapAward): void {
  const work = awardSap(userId, award).then(() => undefined)
  try {
    waitUntil(work)
  } catch {
    // Hors de Vercel (tests, scripts) : la promesse court d'elle-même.
  }
}

// ─── Lire ──────────────────────────────────────────────────────────────────

/** Total de la sève d'un compte — la somme de son journal. */
export async function getSapTotal(userId: string): Promise<number> {
  const { _sum } = await prisma.sapEntry.aggregate({ where: { userId }, _sum: { amount: true } })
  return Math.max(0, _sum.amount ?? 0)
}

/** Gouttes déjà offertes pendant la semaine ISO de `day`. */
async function giftsSentThisWeek(userId: string, day: string): Promise<number> {
  return prisma.sapGift.count({ where: { fromUserId: userId, week: isoWeekKey(day) } })
}

export interface SapSummaryRecord {
  total: number
  rings: ReturnType<typeof sapRings>
  giftsLeft: number
  giftsPerWeek: number
  recent: SapEntry[]
}

/**
 * Tout ce que montrent la carte de l'Accueil et le haut de « Ta sève ».
 *
 * Les entités Prisma sont rendues brutes ; la route les sérialise.
 */
export async function getSapSummary(userId: string, now: Date = new Date()): Promise<SapSummaryRecord> {
  const timeZone = await userTimeZone(userId)
  const day = zonedDayIso(now, timeZone)

  const [total, recent, sent] = await Promise.all([
    getSapTotal(userId),
    prisma.sapEntry.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: SUMMARY_RECENT_COUNT,
    }),
    giftsSentThisWeek(userId, day),
  ])

  return {
    total,
    rings: sapRings(total),
    giftsLeft: Math.max(0, SAP_GIFTS_PER_WEEK - sent),
    giftsPerWeek: SAP_GIFTS_PER_WEEK,
    recent,
  }
}

/**
 * L'historique complet, du plus récent au plus ancien, par curseur
 * `(createdAt, id)` — même mécanique que les listes de la Communauté.
 */
export async function listSapHistory(
  userId: string,
  rawCursor: string | null,
  size: number = HISTORY_PAGE_SIZE,
): Promise<{ items: SapEntry[]; nextCursor: string | null }> {
  const cursor = decodeCursor(rawCursor)

  const rows = await prisma.sapEntry.findMany({
    where: {
      userId,
      ...(cursor
        ? {
            OR: [
              { createdAt: { lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, id: { lt: cursor.id } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: size + 1,
  })

  return takePage(rows, size)
}

// ─── Offrir une goutte ─────────────────────────────────────────────────────

/**
 * Offre une goutte de sève à un voisin.
 *
 * La goutte **ne sort pas** de la sève du donneur : c'est un merci en plus.
 * Le receveur gagne `gift_received`, écrit dans la même transaction que la
 * goutte pour qu'il n'existe jamais de goutte sans le gain qui va avec.
 *
 * Mêmes règles d'accès que la Communauté : on ne peut remercier qu'un profil
 * public, actif, et qui ne nous a pas bloqués — et ces trois cas répondent la
 * même 404, pour ne rien révéler à celui dont on se protège.
 *
 * @throws ServiceError('FORBIDDEN') si le donneur n'a pas de profil public :
 *   le receveur doit pouvoir lire qui le remercie.
 * @throws ServiceError('NOT_FOUND') si le receveur n'est pas joignable.
 * @throws ServiceError('INVALID_INPUT') pour soi-même ou un mot refusé.
 * @throws ServiceError('QUOTA_EXCEEDED') au-delà de trois gouttes par semaine.
 */
export async function giveSapDrop(
  fromUserId: string,
  input: GiveSapDropInput,
  now: Date = new Date(),
): Promise<GiveSapDropResult> {
  const [giver, receiver] = await Promise.all([
    prisma.user.findUnique({
      where: { id: fromUserId },
      select: { id: true, handle: true, communityEnabled: true, timezone: true },
    }),
    prisma.user.findUnique({
      where: { handle: input.handle },
      select: { id: true, handle: true, communityEnabled: true, disabledAt: true, timezone: true },
    }),
  ])

  if (!giver?.communityEnabled || !giver.handle) {
    throw new ServiceError('FORBIDDEN', 'Active ton profil public pour remercier un voisin')
  }

  if (!receiver || !receiver.communityEnabled || receiver.disabledAt || !receiver.handle) {
    throw new ServiceError('NOT_FOUND', 'Profil introuvable')
  }
  if (receiver.id === giver.id) {
    throw new ServiceError('INVALID_INPUT', 'Tu ne peux pas t’offrir une goutte à toi-même')
  }
  // Un blocage, dans un sens ou dans l'autre, rend le profil injoignable —
  // la même règle que `hiddenUserIds`, lue ici sans importer le service des
  // profils, qui importera bientôt celui-ci.
  const block = await prisma.block.findFirst({
    where: {
      OR: [
        { blockerId: giver.id, blockedId: receiver.id },
        { blockerId: receiver.id, blockedId: giver.id },
      ],
    },
    select: { blockerId: true },
  })
  if (block) {
    throw new ServiceError('NOT_FOUND', 'Profil introuvable')
  }

  const message = input.message?.trim() || null
  if (message && findBlockedTerm(message)) {
    throw new ServiceError('INVALID_INPUT', BLOCKED_TERM_MESSAGE)
  }

  const giverDay = zonedDayIso(now, giver.timezone)
  const week = isoWeekKey(giverDay)
  const sent = await prisma.sapGift.count({ where: { fromUserId: giver.id, week } })
  if (sent >= SAP_GIFTS_PER_WEEK) {
    throw new ServiceError('QUOTA_EXCEEDED', 'Tu as offert toutes tes gouttes de la semaine')
  }

  await prisma.$transaction(async (tx) => {
    const gift = await tx.sapGift.create({
      data: {
        fromUserId: giver.id,
        toUserId: receiver.id,
        reason: input.reason,
        message,
        postId: input.postId ?? null,
        week,
      },
    })

    await tx.sapEntry.create({
      data: {
        userId: receiver.id,
        kind: 'gift_received',
        amount: SAP_RULES.gift_received.amount,
        sourceId: gift.id,
        day: zonedDayIso(now, receiver.timezone),
        label: `@${giver.handle} t’a offert une goutte ${SAP_GIFT_REASON_PHRASES[input.reason]}`,
      },
    })
  })

  trackServer(giver.id, 'sap_gift_sent', { reason: input.reason })

  return { giftsLeft: Math.max(0, SAP_GIFTS_PER_WEEK - sent - 1) }
}
