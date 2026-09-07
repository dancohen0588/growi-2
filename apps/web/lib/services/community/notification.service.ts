import {
  NOTIFICATION_RETENTION_DAYS,
  type CommunityNotification,
  type CommunityNotificationPage,
  type NotificationKind,
  type NotificationTarget,
  type UnreadCount,
} from '@growi/shared'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { sendToUser } from '@/lib/services/push.service'

import { decodeCursor, takePage } from './cursor'
import { COMMUNITY_USER_SELECT, toCommunityUser } from './serializers'

/**
 * Notifications de la communauté.
 *
 * Deux canaux, un seul point d'écriture : une ligne `Notification` — le
 * journal in-app, consultable à la cloche — et, pour certains événements
 * seulement, un push.
 *
 * **Rien ici ne lève.** Une notification est un agrément ; échouer à
 * l'écrire ne doit pas faire échouer le suivi ou le commentaire qui l'a
 * déclenchée. Les appelants n'attendent d'ailleurs pas le résultat.
 */

const NOTIFICATIONS_PAGE_SIZE = 20

/**
 * Fenêtre d'agrégation des cœurs.
 *
 * Au plus une notification « like » par publication et par heure : sans cela,
 * une photo qui plaît ferait dix lignes identiques dans la cloche, et
 * l'utilisateur cesserait de l'ouvrir.
 */
const LIKE_AGGREGATION_WINDOW_MS = 60 * 60 * 1000

/** Les seuls événements qui font sonner un téléphone, et leur interrupteur. */
const PUSH_SETTING: Partial<Record<NotificationKind, 'comments' | 'messages' | 'follows'>> = {
  comment: 'comments',
  follow: 'follows',
  listing_interest: 'messages',
  listing_message: 'messages',
}

interface NotifyParams {
  userId: string
  actorId: string
  kind: NotificationKind
  target: NotificationTarget
  preview: string
  /** Titre et corps du push. Absents ⇒ notification in-app seulement. */
  push?: { title: string; body: string }
}

/**
 * Écrit la notification, puis pousse si l'événement et les réglages du
 * destinataire s'y prêtent.
 *
 * L'ordre compte : la ligne d'abord, le push ensuite. Un push parti sans
 * ligne correspondante mènerait sur une cloche vide.
 */
async function notify(params: NotifyParams): Promise<void> {
  try {
    // On ne se notifie pas soi-même — commenter sa propre publication est
    // courant, et l'annoncer serait absurde.
    if (params.userId === params.actorId) return

    await prisma.notification.create({
      data: {
        userId: params.userId,
        actorId: params.actorId,
        kind: params.kind,
        target: params.target as Prisma.InputJsonValue,
        preview: params.preview,
      },
    })

    if (!params.push) return

    const setting = PUSH_SETTING[params.kind]
    if (!setting) return

    const recipient = await prisma.user.findUnique({
      where: { id: params.userId },
      select: { alertConfig: true },
    })
    const community = (recipient?.alertConfig as { community?: Record<string, boolean> } | null)
      ?.community

    // Absent ⇒ valeur par défaut de `DEFAULT_ALERT_CONFIG` : commentaires et
    // messages oui, abonnements non.
    const wanted = community?.[setting] ?? setting !== 'follows'
    if (!wanted) return

    await sendToUser(params.userId, {
      title: params.push.title,
      body: params.push.body,
      sound: 'default',
      data: { kind: params.kind, ...params.target },
    })
  } catch (error) {
    console.error('[communauté] notification impossible :', error)
  }
}

// ─── Composeurs ────────────────────────────────────────────────────────────

/** Quelqu'un s'est abonné. */
export async function notifyFollow(
  actor: { id: string; handle: string | null },
  targetUserId: string,
): Promise<void> {
  const who = actor.handle ?? 'Un jardinier'

  await notify({
    userId: targetUserId,
    actorId: actor.id,
    kind: 'follow',
    target: { handle: actor.handle, postId: null },
    preview: `${who} s’est abonné à ton jardin`,
    push: { title: 'Un nouvel abonné 🌿', body: `${who} suit désormais ton jardin.` },
  })
}

/** Quelqu'un a commenté une publication. */
export async function notifyComment(
  actor: { id: string; handle: string | null },
  post: { id: string; userId: string },
  body: string,
): Promise<void> {
  const who = actor.handle ?? 'Un jardinier'
  // Le texte du commentaire est repris tel quel, tronqué : c'est ce qui donne
  // envie d'ouvrir, bien plus que « tu as un nouveau commentaire ».
  const excerpt = body.length > 80 ? `${body.slice(0, 79)}…` : body

  await notify({
    userId: post.userId,
    actorId: actor.id,
    kind: 'comment',
    target: { postId: post.id, handle: actor.handle },
    preview: `${who} a commenté ta publication : « ${excerpt} »`,
    push: { title: `${who} a commenté 💬`, body: excerpt },
  })
}

/**
 * Quelqu'un a aimé une publication.
 *
 * **Agrégé, et jamais poussé.** Une notification existante de moins d'une
 * heure sur la même publication est réécrite plutôt que doublée : « Marc et 4
 * autres ont aimé ta photo ». Un cœur ne vaut pas qu'un téléphone sonne.
 */
export async function notifyLike(
  actor: { id: string; handle: string | null },
  post: { id: string; userId: string; likeCount: number },
): Promise<void> {
  try {
    if (post.userId === actor.id) return

    const who = actor.handle ?? 'Un jardinier'
    const others = Math.max(0, post.likeCount - 1)
    const preview =
      others > 0
        ? `${who} et ${others} autre${others > 1 ? 's' : ''} ont aimé ta publication`
        : `${who} a aimé ta publication`

    const since = new Date(Date.now() - LIKE_AGGREGATION_WINDOW_MS)
    const recent = await prisma.notification.findFirst({
      where: {
        userId: post.userId,
        kind: 'like',
        createdAt: { gte: since },
        // `equals` sur une colonne Json : la cible est écrite par nous, donc
        // sa forme est connue.
        target: { path: ['postId'], equals: post.id },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    })

    if (recent) {
      // Réécrite, et **remise en non-lue** : c'est une nouvelle information,
      // même si elle occupe la même ligne.
      await prisma.notification.update({
        where: { id: recent.id },
        data: { preview, actorId: actor.id, readAt: null, createdAt: new Date() },
      })
      return
    }

    await prisma.notification.create({
      data: {
        userId: post.userId,
        actorId: actor.id,
        kind: 'like',
        target: { postId: post.id, handle: actor.handle } as Prisma.InputJsonValue,
        preview,
      },
    })
  } catch (error) {
    console.error('[communauté] notification de cœur impossible :', error)
  }
}

// ─── Lecture ───────────────────────────────────────────────────────────────

function readTarget(value: Prisma.JsonValue): NotificationTarget {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { postId: null, handle: null }
  }

  const record = value as Record<string, unknown>
  return {
    postId: typeof record.postId === 'string' ? record.postId : null,
    handle: typeof record.handle === 'string' ? record.handle : null,
  }
}

/** Une page de notifications, de la plus récente à la plus ancienne. */
export async function listNotifications(
  userId: string,
  rawCursor: string | null,
): Promise<CommunityNotificationPage> {
  const cursor = decodeCursor(rawCursor)

  const rows = await prisma.notification.findMany({
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
    take: NOTIFICATIONS_PAGE_SIZE + 1,
  })

  const page = takePage(rows, NOTIFICATIONS_PAGE_SIZE)

  // `actorId` n'a pas de clé étrangère (voir le modèle) : on va chercher les
  // acteurs encore présents, et une notification dont l'acteur a disparu reste
  // lisible grâce à son `preview` figé.
  const actorIds = [...new Set(page.items.map((row) => row.actorId).filter(Boolean))] as string[]
  const actors = actorIds.length
    ? await prisma.user.findMany({
        where: { id: { in: actorIds } },
        select: COMMUNITY_USER_SELECT,
      })
    : []
  const byId = new Map(actors.map((actor) => [actor.id, actor]))

  const items: CommunityNotification[] = page.items.map((row) => {
    const actor = row.actorId ? byId.get(row.actorId) : undefined

    return {
      id: row.id,
      kind: row.kind as CommunityNotification['kind'],
      // Pas de distance ici : la cloche n'est pas un fil, et calculer une
      // proximité pour chaque ligne coûterait sans rien apporter.
      actor: actor ? toCommunityUser(actor, null) : null,
      preview: row.preview,
      target: readTarget(row.target),
      readAt: row.readAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }
  })

  return { items, nextCursor: page.nextCursor }
}

export async function unreadCount(userId: string): Promise<UnreadCount> {
  return { unread: await prisma.notification.count({ where: { userId, readAt: null } }) }
}

/**
 * Marque tout comme lu.
 *
 * Tout, et non ligne par ligne : la cloche se consulte d'un coup d'œil, et
 * demander à l'utilisateur de cocher vingt lignes pour éteindre un badge
 * serait une corvée sans contrepartie.
 */
export async function markAllRead(userId: string): Promise<UnreadCount> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  })
  return { unread: 0 }
}

/**
 * Purge les notifications lues au-delà du délai de conservation.
 *
 * Appelée par la tournée quotidienne : une table qui ne fait que grossir
 * finirait par ralentir le badge, qui est lu à chaque ouverture de l'app. Les
 * non-lues sont épargnées quel que soit leur âge — quelqu'un qui revient après
 * trois mois doit retrouver ce qu'il a manqué.
 */
export async function purgeReadNotifications(now = new Date()): Promise<number> {
  const before = new Date(now.getTime() - NOTIFICATION_RETENTION_DAYS * 24 * 60 * 60 * 1000)

  const { count } = await prisma.notification.deleteMany({
    where: { readAt: { not: null, lt: before } },
  })
  return count
}
