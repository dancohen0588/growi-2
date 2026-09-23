/**
 * Annonce push d'un nouvel article du blog, le lendemain matin de sa
 * publication.
 *
 * La publication (`blog-admin.service`) ne fait que **demander** l'annonce
 * (`pushRequestedAt`) ; c'est la tournée du matin (`/api/cron/daily-reminders`,
 * 6 h UTC) qui l'envoie. Publier à 23 h ne réveille donc personne, et tout le
 * monde la reçoit à une heure où l'on regarde son téléphone.
 *
 * Mêmes règles que les rappels du matin : le canal doit inclure le push, les
 * heures calmes sont respectées, et l'interrupteur « Nouveaux conseils »
 * (`alertConfig.blogArticles`) permet de s'en passer.
 */

import { DEFAULT_ALERT_CONFIG, type AlertConfig, type BlogPostStatus } from '@growi/shared'

import { trackServer } from '@/lib/analytics/server'
import { prisma } from '@/lib/prisma'
import { sendPushMessages, type PushMessage } from '@/lib/push/expo-push'
import {
  channelAllowsPush,
  forgetInvalidTokens,
  inQuietHours,
  localMinutes,
} from '@/lib/services/push.service'

const LOG = '[blog-push]'

export const ANNOUNCEMENT_TITLE = 'Nouveau conseil de saison 🌱'

export interface AnnouncementResult {
  /** Slug annoncé, ou `null` s'il n'y avait rien à annoncer. */
  slug: string | null
  notified: number
  sent: number
  failed: number
  invalidTokensRemoved: number
}

/** Le compte veut-il l'annonce d'un article, maintenant ? */
export function wantsBlogAnnouncement(config: AlertConfig, localMinute: number): boolean {
  return channelAllowsPush(config) && !inQuietHours(config, localMinute) && config.blogArticles
}

/**
 * Annonce **un** article par passage — le plus ancien en attente. Deux
 * articles publiés le même jour partent deux matins de suite plutôt que
 * d'arriver en rafale.
 *
 * L'article est réservé (`pushSentAt`) **avant** l'envoi, par une écriture
 * conditionnelle : un cron relancé par Vercel trouve la place prise et ne
 * notifie pas une seconde fois. Un envoi qui échoue en route n'est pas
 * retenté — une annonce manquée vaut mieux qu'une annonce en double.
 *
 * Ne lève pas pour un envoi raté ; une erreur de base remonte à l'appelant,
 * qui l'isole des autres étapes de la tournée.
 */
export async function announceNewArticle(
  now = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<AnnouncementResult> {
  const result: AnnouncementResult = { slug: null, notified: 0, sent: 0, failed: 0, invalidTokensRemoved: 0 }

  const pending = await prisma.blogPost.findFirst({
    where: {
      status: 'PUBLISHED' satisfies BlogPostStatus,
      pushRequestedAt: { not: null, lte: now },
      pushSentAt: null,
    },
    orderBy: { pushRequestedAt: 'asc' },
    select: { id: true, slug: true, title: true },
  })
  if (!pending) return result

  // Réservation : seul le passage qui écrit la date envoie.
  const claimed = await prisma.blogPost.updateMany({
    where: { id: pending.id, pushSentAt: null },
    data: { pushSentAt: now },
  })
  if (claimed.count === 0) return result
  result.slug = pending.slug

  const users = await prisma.user.findMany({
    where: { disabledAt: null, pushTokens: { some: {} } },
    select: { id: true, timezone: true, alertConfig: true, pushTokens: { select: { token: true } } },
  })

  const messages: PushMessage[] = []
  for (const user of users) {
    const config: AlertConfig = {
      ...DEFAULT_ALERT_CONFIG,
      ...((user.alertConfig as AlertConfig | null) ?? {}),
    }
    if (!wantsBlogAnnouncement(config, localMinutes(now, user.timezone))) continue

    result.notified += 1
    trackServer(user.id, 'push_sent', { kind: 'blog', tokens_count: user.pushTokens.length })

    for (const { token } of user.pushTokens) {
      messages.push({
        to: token,
        title: ANNOUNCEMENT_TITLE,
        body: pending.title,
        sound: 'default',
        // Le slug seul, sans `kind` : l'app classe « communauté » toute
        // notification qui porte un `kind`. Une version de l'app qui ne
        // connaît pas `slug` ouvre simplement l'app.
        data: { slug: pending.slug },
      })
    }
  }

  const outcome = await sendPushMessages(messages, fetchImpl)
  await forgetInvalidTokens(outcome.invalidTokens)

  result.sent = outcome.sent
  result.failed = outcome.failed
  result.invalidTokensRemoved = outcome.invalidTokens.length

  console.info(`${LOG} « ${pending.slug} » annoncé à ${result.notified} compte(s), ${result.sent} appareil(s)`)
  return result
}
