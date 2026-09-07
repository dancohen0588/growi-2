import {
  AUTO_HIDE_REPORT_THRESHOLD,
  BLOCKED_TERM_MESSAGE,
  findBlockedTerm,
  type CreateReportInput,
  type ReportReceipt,
  type ReportTarget,
} from '@growi/shared'
import { Prisma } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { addresses, getResendClient } from '@/lib/services/contact.service'
import { ServiceError } from '@/lib/services/errors'
import { SITE_URL } from '@/lib/site-url'

/**
 * Signalements, liste noire de saisie et masquage.
 *
 * Le geste de l'utilisateur est volontairement pauvre — un motif, une note
 * facultative, et rien en retour. Ce qu'on en fait vit ici : le seuil au-delà
 * duquel un contenu se masque tout seul, et les actions du portail admin.
 */

/**
 * Refuse un texte qui contient un terme de la liste noire.
 *
 * Appelée **à la saisie**, sur tout ce qui devient visible d'autrui :
 * publication, commentaire, annonce, message. Elle n'attrape que ce qui se
 * tape sans réfléchir ; c'est le signalement qui fait le vrai travail.
 *
 * @throws ServiceError('INVALID_INPUT') avec un message qui invite à
 * reformuler, sans citer le terme — le répéter à son auteur n'aiderait
 * personne.
 */
export function assertClean(...texts: (string | null | undefined)[]): void {
  for (const text of texts) {
    if (!text) continue
    if (findBlockedTerm(text)) {
      throw new ServiceError('INVALID_INPUT', BLOCKED_TERM_MESSAGE)
    }
  }
}

// ─── Signalement ───────────────────────────────────────────────────────────

/** Les types de cible qui désignent un contenu masquable. */
const CONTENT_TARGETS = ['post', 'comment', 'listing'] as const
type ContentTarget = (typeof CONTENT_TARGETS)[number]

function isContentTarget(target: ReportTarget): target is ContentTarget {
  return (CONTENT_TARGETS as readonly string[]).includes(target)
}

/**
 * Enregistre un signalement, puis masque le contenu s'il en a reçu assez.
 *
 * **Idempotent.** L'unicité `(reporterId, targetType, targetId)` fait qu'on ne
 * signale un contenu qu'une fois ; recommencer n'est pas une faute à afficher,
 * c'est de l'insistance. La route répond donc la même chose dans les deux cas.
 *
 * La réponse ne dit rien du nombre de signalements reçus ni de l'état du
 * contenu : ce compteur deviendrait sinon un instrument de mesure pour qui
 * cherche à faire taire quelqu'un.
 *
 * @throws ServiceError('NOT_FOUND') si le compte signalé n'existe pas,
 * ServiceError('INVALID_INPUT') si l'on se signale soi-même.
 */
export async function report(
  userId: string,
  input: CreateReportInput,
): Promise<ReportReceipt> {
  if (input.targetType === 'user') {
    if (input.targetId === userId) {
      throw new ServiceError('INVALID_INPUT', 'On ne se signale pas soi-même.')
    }

    const target = await prisma.user.findUnique({
      where: { id: input.targetId },
      select: { id: true },
    })
    if (!target) throw new ServiceError('NOT_FOUND', 'Ce compte est introuvable.')
  }

  const { count } = await prisma.report.createMany({
    data: {
      reporterId: userId,
      targetType: input.targetType,
      targetId: input.targetId,
      reason: input.reason,
      note: input.note ?? null,
    },
    skipDuplicates: true,
  })

  // Rien de neuf ⇒ rien à réévaluer : le seuil n'a pas pu être franchi par un
  // signalement qui n'a pas été écrit.
  if (count > 0 && isContentTarget(input.targetType)) {
    await autoHideIfNeeded(input.targetType, input.targetId)
  }

  return { reported: true }
}

/**
 * Nombre de **personnes distinctes** ayant signalé un contenu.
 *
 * L'unicité en base fait tout le travail : une ligne par signaleur, donc
 * compter les lignes revient à compter les personnes. C'est ce qui empêche un
 * seul signaleur acharné d'atteindre le seuil à lui tout seul.
 */
export async function countReports(targetType: string, targetId: string): Promise<number> {
  return prisma.report.count({ where: { targetType, targetId } })
}

/**
 * Masque un contenu qui a franchi le seuil, et prévient son auteur.
 *
 * Le masquage est **automatique et provisoire** : il précède la revue, il ne
 * la remplace pas. Masquer tôt coûte un contenu légitime le temps d'une
 * vérification ; masquer tard laisse une insulte à l'écran de tout un
 * quartier.
 *
 * Ne lève jamais : un signalement doit être enregistré même si le masquage
 * échoue — c'est lui qui déclenchera la revue humaine.
 */
async function autoHideIfNeeded(targetType: ContentTarget, targetId: string): Promise<void> {
  try {
    const distinct = await countReports(targetType, targetId)
    if (distinct < AUTO_HIDE_REPORT_THRESHOLD) return

    const hidden = await setContentStatus(targetType, targetId, 'hidden', { onlyVisible: true })
    if (!hidden) return

    await prisma.notification.create({
      data: {
        userId: hidden.userId,
        // Sans acteur : ce n'est personne en particulier, c'est un seuil.
        actorId: null,
        kind: 'moderation',
        target: { postId: null, threadId: null, listingId: null, handle: null } as Prisma.InputJsonValue,
        preview:
          'Un de tes contenus a été masqué le temps d’une vérification. Nous revenons vers toi.',
      },
    })
  } catch (error) {
    console.error('[modération] masquage automatique impossible :', error)
  }
}

/**
 * Change le statut d'un contenu, quel que soit son type.
 *
 * Rend l'auteur et le statut précédent, ou `null` si rien n'a changé — ce qui
 * permet à l'appelant de ne journaliser que les actions qui ont eu un effet.
 */
async function setContentStatus(
  targetType: ContentTarget,
  targetId: string,
  status: 'hidden' | 'visible' | 'active',
  options: { onlyVisible?: boolean } = {},
): Promise<{ userId: string; previousStatus: string } | null> {
  const where = { id: targetId } as { id: string }

  const current =
    targetType === 'post'
      ? await prisma.post.findUnique({ where, select: { userId: true, status: true } })
      : targetType === 'comment'
        ? await prisma.comment.findUnique({ where, select: { userId: true, status: true } })
        : await prisma.listing.findUnique({ where, select: { userId: true, status: true } })

  if (!current) return null
  // Une suppression par son auteur l'emporte sur toute décision de modération :
  // il n'y a plus rien à masquer ni à rétablir.
  if (current.status === 'deleted') return null
  if (options.onlyVisible && current.status === 'hidden') return null
  if (current.status === status) return null

  if (targetType === 'post') await prisma.post.update({ where, data: { status } })
  else if (targetType === 'comment') await prisma.comment.update({ where, data: { status } })
  else await prisma.listing.update({ where, data: { status } })

  return { userId: current.userId, previousStatus: current.status }
}

/**
 * Masque ou rétablit un contenu depuis le portail admin.
 *
 * Une annonce rétablie repart en `active` et non en `visible` : son vocabulaire
 * de statut lui est propre.
 *
 * @throws ServiceError('NOT_FOUND') si le contenu n'existe plus.
 */
export async function setModerationStatus(
  targetType: string,
  targetId: string,
  hide: boolean,
): Promise<{ userId: string; previousStatus: string }> {
  if (!isContentTarget(targetType as ReportTarget)) {
    throw new ServiceError('INVALID_INPUT', 'Ce type de contenu ne se masque pas.')
  }

  const target = targetType as ContentTarget
  const status = hide ? 'hidden' : target === 'listing' ? 'active' : 'visible'

  const result = await setContentStatus(target, targetId, status)
  if (!result) {
    throw new ServiceError('NOT_FOUND', 'Ce contenu n’existe plus, ou est déjà dans cet état.')
  }

  return result
}

// ─── File de modération (portail admin) ────────────────────────────────────

export interface ReportGroup {
  targetType: string
  targetId: string
  /** Personnes distinctes ayant signalé. */
  count: number
  /** Motifs invoqués, un par signalement. */
  reasons: string[]
  /**
   * Notes laissées par les signaleurs.
   *
   * Elles sont montrées telles quelles : c'est souvent la seule chose qui
   * explique *pourquoi* un contenu dérange, là où le motif seul ne dit rien.
   */
  notes: string[]
  firstReportedAt: Date
  lastReportedAt: Date
  /** Extrait du contenu, ou `null` s'il a disparu. */
  preview: string | null
  /** Statut du contenu — `null` pour un compte, qui n'en a pas. */
  status: string | null
  /** Auteur du contenu, ou le compte signalé. */
  author: { id: string; handle: string | null; email: string; disabledAt: Date | null } | null
}

/**
 * La file de modération, **groupée par contenu** et triée par nombre de
 * signalements.
 *
 * Groupée : trois personnes qui signalent la même photo, c'est une décision à
 * prendre, pas trois. Triée par nombre plutôt que par date, parce qu'un
 * contenu que trois voisins ont signalé passe avant un signalement isolé.
 */
export async function listOpenReports(limit = 50): Promise<ReportGroup[]> {
  const rows = await prisma.report.findMany({
    where: { status: 'open' },
    orderBy: { createdAt: 'asc' },
    select: {
      targetType: true,
      targetId: true,
      reason: true,
      note: true,
      createdAt: true,
    },
  })

  const groups = new Map<string, ReportGroup>()
  for (const row of rows) {
    const key = `${row.targetType}:${row.targetId}`
    const existing = groups.get(key)

    if (existing) {
      existing.count += 1
      existing.reasons.push(row.reason)
      if (row.note) existing.notes.push(row.note)
      existing.lastReportedAt = row.createdAt
      continue
    }

    groups.set(key, {
      targetType: row.targetType,
      targetId: row.targetId,
      count: 1,
      reasons: [row.reason],
      notes: row.note ? [row.note] : [],
      firstReportedAt: row.createdAt,
      lastReportedAt: row.createdAt,
      preview: null,
      status: null,
      author: null,
    })
  }

  const sorted = [...groups.values()]
    .sort((a, b) => b.count - a.count || a.firstReportedAt.getTime() - b.firstReportedAt.getTime())
    .slice(0, limit)

  await Promise.all(sorted.map((group) => hydrateGroup(group)))
  return sorted
}

/** Le contenu signalé, tel qu'on le montre à l'administrateur. */
async function hydrateGroup(group: ReportGroup): Promise<void> {
  const author = {
    select: { id: true, handle: true, email: true, disabledAt: true },
  } as const

  if (group.targetType === 'post') {
    const post = await prisma.post.findUnique({
      where: { id: group.targetId },
      select: { body: true, status: true, user: author },
    })
    if (!post) return
    group.preview = post.body || '(sans texte)'
    group.status = post.status
    group.author = post.user
    return
  }

  if (group.targetType === 'comment') {
    const comment = await prisma.comment.findUnique({
      where: { id: group.targetId },
      select: { body: true, status: true, user: author },
    })
    if (!comment) return
    group.preview = comment.body
    group.status = comment.status
    group.author = comment.user
    return
  }

  if (group.targetType === 'listing') {
    const listing = await prisma.listing.findUnique({
      where: { id: group.targetId },
      select: { title: true, description: true, status: true, user: author },
    })
    if (!listing) return
    group.preview = [listing.title, listing.description].filter(Boolean).join(' — ')
    group.status = listing.status
    group.author = listing.user
    return
  }

  if (group.targetType === 'user') {
    const user = await prisma.user.findUnique({
      where: { id: group.targetId },
      select: { id: true, handle: true, email: true, disabledAt: true, bio: true },
    })
    if (!user) return
    group.preview = user.bio ?? '(profil sans présentation)'
    group.author = user
  }

  // `message` n'est pas hydraté : un message privé n'est pas lisible par
  // l'administration. Le signalement reste dans la file, avec son motif, et la
  // décision porte sur le compte — pas sur un contenu qu'on n'a pas lu.
}

/** Signalements ouverts, tous confondus — le badge de la navigation. */
export async function countOpenReports(): Promise<number> {
  return prisma.report.count({ where: { status: 'open' } })
}

/**
 * Au-delà de ce nombre de signalements ouverts, un email part chaque jour.
 *
 * Le badge de la navigation suffit tant qu'on ouvre l'admin ; l'email est là
 * pour le jour où on ne l'ouvre pas — et il ne part qu'au-delà du seuil, sinon
 * il deviendrait un courrier quotidien qu'on finirait par filtrer.
 */
export const REPORT_ALERT_THRESHOLD = 5

export interface ReportAlertResult {
  open: number
  sent: boolean
}

/**
 * Prévient l'administration si la file déborde.
 *
 * Appelée par la tournée quotidienne. Ne lève jamais : une alerte manquée est
 * un email en moins, pas une raison de faire échouer les rappels du matin.
 */
export async function sendOpenReportsAlert(): Promise<ReportAlertResult> {
  const open = await countOpenReports()
  if (open <= REPORT_ALERT_THRESHOLD) return { open, sent: false }

  const resend = getResendClient()
  // Sans clé, le badge de l'admin reste le seul rappel — c'est déjà mieux que
  // rien, et la file, elle, est bien tenue.
  if (!resend) return { open, sent: false }

  const { from, to } = addresses()

  try {
    await resend.emails.send({
      from,
      to,
      subject: `${open} signalements en attente sur Growi`,
      html: `<p>La file de modération compte <strong>${open}</strong> signalements ouverts.</p>
             <p><a href="${SITE_URL}/admin/signalements">Ouvrir la file</a></p>`,
    })
    return { open, sent: true }
  } catch (error) {
    console.error('[modération] alerte de seuil non envoyée :', error)
    return { open, sent: false }
  }
}

/**
 * Clôt tous les signalements ouverts d'un contenu.
 *
 * Tous, et pas un par un : la décision porte sur le contenu, pas sur chaque
 * personne qui l'a signalé. Rend le nombre de signalements clos.
 */
export async function resolveReports(
  targetType: string,
  targetId: string,
  status: 'actioned' | 'dismissed',
  reviewerId: string,
  tx: Prisma.TransactionClient = prisma,
): Promise<number> {
  const { count } = await tx.report.updateMany({
    where: { targetType, targetId, status: 'open' },
    data: { status, reviewedById: reviewerId, reviewedAt: new Date() },
  })
  return count
}
