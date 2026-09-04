/**
 * Messagerie de contact — réception, lecture, réponse.
 *
 * Jusqu'ici, un message partait en email et disparaissait : rien n'en restait
 * pour répondre, ni pour compter. Il est désormais **écrit d'abord, notifié
 * ensuite**, et cet ordre porte toute la logique du fichier :
 *
 * - le visiteur ne voit une erreur que si l'**insertion** échoue ;
 * - un refus de Resend — clé absente, domaine non vérifié, quota — ne perd
 *   rien : le message est en base, l'admin le verra, `notifiedAt` reste `null`
 *   et dit qu'aucun email n'est parti.
 *
 * Comme les autres services, celui-ci ne lit jamais la session.
 */

import type { ContactMessageSource, ContactMessageStatus } from '@growi/shared'
import type { Prisma } from '@prisma/client'
import { Resend } from 'resend'

import { prisma } from '@/lib/prisma'
import { CONTACT_SUBJECTS } from '@/lib/schemas/contact-schema'
import { ServiceError } from '@/lib/services/errors'
import { SITE_URL } from '@/lib/site-url'

/** Adresse de la boîte de contact, et repli affiché au visiteur. */
export const CONTACT_EMAIL = 'info@growi-garden.fr'

/**
 * Resend n'expédie que depuis un domaine vérifié chez lui. Tant que
 * `growi-garden.fr` ne l'est pas, `CONTACT_FROM_EMAIL` permet d'emprunter un
 * domaine qui l'est. Lu à l'appel, jamais au chargement du module.
 */
export function addresses() {
  return {
    from: process.env.CONTACT_FROM_EMAIL ?? CONTACT_EMAIL,
    to: process.env.CONTACT_TO_EMAIL ?? CONTACT_EMAIL,
  }
}

/** `null` quand la clé manque — l'appelant décide quoi en faire. */
export function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY
  return key ? new Resend(key) : null
}

/** L'envoi d'emails est-il possible ? Sert au bandeau de l'admin. */
export function isMailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY)
}

/**
 * Ce qu'un tiers écrit finit dans un email HTML. Sans échappement, il choisit
 * la mise en forme de ce qu'on reçoit — et y glisse ce qu'il veut.
 */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Libellé lisible d'un sujet, sans son emoji. */
export function subjectLabel(subject?: string | null, otherSubject?: string | null): string {
  if (!subject) return 'Sans sujet'
  if (subject === 'autre') return otherSubject?.trim() || 'Autre'
  const entry = CONTACT_SUBJECTS.find((s) => s.value === subject)
  return entry?.label.replace(/^[^\s]+ /, '') ?? subject
}

// ─── Réception ─────────────────────────────────────────────────────────────

export type ReceiveInput = {
  source?: ContactMessageSource
  firstName?: string | null
  lastName?: string | null
  email: string
  phone?: string | null
  subject?: string | null
  otherSubject?: string | null
  body: string
}

/**
 * Enregistre un message, puis tente la notification.
 *
 * Le rattachement au compte Growi se fait **sans tenir compte de la casse** :
 * quelqu'un qui écrit depuis `Sophie@Exemple.fr` est le même que celui inscrit
 * en `sophie@exemple.fr`, et le support a besoin de le voir.
 *
 * @throws ServiceError('UNAVAILABLE') si l'écriture échoue — le seul cas où le
 * visiteur doit voir un échec.
 */
export async function receive(input: ReceiveInput) {
  const email = input.email.trim()

  const account = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  })

  let message
  try {
    message = await prisma.contactMessage.create({
      data: {
        source: input.source ?? 'contact',
        firstName: input.firstName?.trim() || null,
        lastName: input.lastName?.trim() || null,
        email,
        phone: input.phone?.trim() || null,
        subject: input.subject ?? null,
        otherSubject: input.otherSubject?.trim() || null,
        body: input.body,
        userId: account?.id ?? null,
      },
    })
  } catch (err) {
    console.error('[contact] écriture du message impossible', err)
    throw new ServiceError('UNAVAILABLE', 'Une erreur est survenue. Réessaie dans quelques instants.')
  }

  // À partir d'ici, plus rien ne peut faire échouer la réception : le message
  // est acquis. La notification n'est qu'un confort pour l'équipe.
  const notified = await notifyTeam(message.id, input, email)
  if (notified) {
    await prisma.contactMessage
      .update({ where: { id: message.id }, data: { notifiedAt: new Date() } })
      .catch((err) => console.error('[contact] notifiedAt non enregistré', err))
  }

  return message
}

/** Envoie l'email d'alerte à l'équipe. Ne lève jamais. */
async function notifyTeam(
  messageId: string,
  input: ReceiveInput,
  email: string,
): Promise<boolean> {
  const resend = getResendClient()
  if (!resend) {
    console.error('[contact] RESEND_API_KEY absente : message conservé, non notifié.')
    return false
  }

  const { from, to } = addresses()
  const label = subjectLabel(input.subject, input.otherSubject)
  const who = [input.firstName, input.lastName].filter(Boolean).join(' ') || email
  const isBeta = input.source === 'beta_ios'

  try {
    const result = await resend.emails.send({
      from: `Growi ${isBeta ? 'Bêta' : 'Contact'} <${from}>`,
      to,
      replyTo: email,
      subject: isBeta ? 'Bêta iOS' : `[Growi Contact] ${label} — ${who}`,
      html: notificationHtml({ messageId, input, email, label, isBeta }),
    })

    if (result.error) {
      console.error('[contact] Resend a refusé la notification', result.error)
      return false
    }
    return true
  } catch (err) {
    console.error('[contact] notification non envoyée', err)
    return false
  }
}

function notificationHtml({
  messageId,
  input,
  email,
  label,
  isBeta,
}: {
  messageId: string
  input: ReceiveInput
  email: string
  label: string
  isBeta: boolean
}): string {
  const adminLink = `${SITE_URL}/admin/messages/${messageId}`
  const footer = `
    <p style="margin-top: 24px;">
      <a href="${adminLink}" style="color: #1E5631; font-weight: 600;">Répondre depuis l’admin</a>
    </p>`

  if (isBeta) {
    return `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1E5631;">
        <h2 style="color: #1E5631; border-bottom: 2px solid #B4DD7F; padding-bottom: 12px;">
          Inscription à la bêta iOS
        </h2>
        <p><a href="mailto:${escapeHtml(email)}" style="color: #1E5631;">${escapeHtml(email)}</a></p>
        ${footer}
      </div>`
  }

  const row = (name: string, value: string) => `
    <tr>
      <td style="padding: 8px 0; font-weight: 600; width: 120px;">${name}</td>
      <td style="padding: 8px 0;">${value}</td>
    </tr>`

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1E5631;">
      <h2 style="color: #1E5631; border-bottom: 2px solid #B4DD7F; padding-bottom: 12px;">
        Nouveau message de contact
      </h2>
      <table style="width: 100%; border-collapse: collapse;">
        ${row('Prénom', escapeHtml(input.firstName ?? ''))}
        ${row('Nom', escapeHtml(input.lastName ?? ''))}
        ${row('Email', `<a href="mailto:${escapeHtml(email)}" style="color: #1E5631;">${escapeHtml(email)}</a>`)}
        ${input.phone ? row('Téléphone', escapeHtml(input.phone)) : ''}
        ${row('Sujet', escapeHtml(label))}
      </table>
      <div style="margin-top: 20px; padding: 16px; background: #F9F7E8; border-radius: 8px; border-left: 4px solid #B4DD7F;">
        <p style="margin: 0; white-space: pre-line;">${escapeHtml(input.body)}</p>
      </div>
      ${footer}
    </div>`
}

// ─── Lecture ───────────────────────────────────────────────────────────────

export const MESSAGES_PAGE_SIZE = 50

export type MessageFilters = {
  status?: ContactMessageStatus
  source?: ContactMessageSource
  subject?: string
  search?: string
}

export type MessageCursor = { createdAt: Date; id: string }

function buildMessageWhere(filters: MessageFilters): Prisma.ContactMessageWhereInput {
  const and: Prisma.ContactMessageWhereInput[] = []

  if (filters.status) and.push({ status: filters.status })
  if (filters.source) and.push({ source: filters.source })
  if (filters.subject) and.push({ subject: filters.subject })

  const search = filters.search?.trim()
  if (search) {
    and.push({
      OR: [
        { email: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { body: { contains: search, mode: 'insensitive' } },
      ],
    })
  }

  return and.length ? { AND: and } : {}
}

const LIST_SELECT = {
  id: true,
  source: true,
  firstName: true,
  lastName: true,
  email: true,
  subject: true,
  otherSubject: true,
  body: true,
  status: true,
  notifiedAt: true,
  createdAt: true,
  userId: true,
  _count: { select: { replies: true } },
} satisfies Prisma.ContactMessageSelect

/** Une page de la boîte de réception, du plus récent au plus ancien. */
export async function list(
  filters: MessageFilters = {},
  cursor?: MessageCursor | null,
  pageSize = MESSAGES_PAGE_SIZE,
) {
  const where = buildMessageWhere(filters)

  if (cursor) {
    where.AND = [
      ...(Array.isArray(where.AND) ? where.AND : where.AND ? [where.AND] : []),
      {
        OR: [
          { createdAt: { lt: cursor.createdAt } },
          { createdAt: cursor.createdAt, id: { lt: cursor.id } },
        ],
      },
    ]
  }

  const rows = await prisma.contactMessage.findMany({
    where,
    select: LIST_SELECT,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: pageSize + 1,
  })

  const hasMore = rows.length > pageSize
  const page = hasMore ? rows.slice(0, pageSize) : rows
  const last = page.at(-1)

  return {
    messages: page,
    nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
  }
}

/** Nombre de messages non traités — le compteur de la navigation. */
export function countNew(): Promise<number> {
  return prisma.contactMessage.count({ where: { status: 'new' } })
}

export function countMessages(filters: MessageFilters = {}): Promise<number> {
  return prisma.contactMessage.count({ where: buildMessageWhere(filters) })
}

/**
 * Un message et son fil.
 * @throws ServiceError('NOT_FOUND')
 */
export async function get(id: string) {
  const message = await prisma.contactMessage.findUnique({
    where: { id },
    include: {
      replies: { orderBy: { sentAt: 'asc' } },
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          name: true,
          createdAt: true,
          lastSeenAt: true,
          disabledAt: true,
          _count: { select: { gardens: true, plantInstances: true } },
        },
      },
    },
  })

  if (!message) throw new ServiceError('NOT_FOUND', 'Message introuvable')
  return message
}

// ─── Écritures ─────────────────────────────────────────────────────────────

/**
 * Envoie une réponse et l'enregistre.
 *
 * L'email part **avant** l'écriture : c'est le seul ordre honnête. Écrire
 * d'abord ferait afficher une réponse envoyée alors qu'elle ne l'est pas, et
 * l'admin n'aurait aucun moyen de s'en apercevoir.
 *
 * @throws ServiceError('NOT_FOUND') · ServiceError('UNAVAILABLE') si l'envoi échoue.
 */
export async function reply(input: {
  messageId: string
  authorId: string
  body: string
}): Promise<{ replyId: string; providerId: string | null }> {
  const message = await prisma.contactMessage.findUnique({
    where: { id: input.messageId },
    select: { id: true, email: true, subject: true, otherSubject: true, body: true },
  })
  if (!message) throw new ServiceError('NOT_FOUND', 'Message introuvable')

  const resend = getResendClient()
  if (!resend) {
    throw new ServiceError(
      'UNAVAILABLE',
      `L’envoi d’emails n’est pas configuré. Réponds directement depuis ${CONTACT_EMAIL}.`,
    )
  }

  const { from } = addresses()
  const label = subjectLabel(message.subject, message.otherSubject)

  let providerId: string | null = null
  try {
    const result = await resend.emails.send({
      from: `Growi <${from}>`,
      to: message.email,
      replyTo: CONTACT_EMAIL,
      subject: `Re: ${label}`,
      html: replyHtml(input.body, message.body),
    })

    if (result.error) {
      console.error('[contact] Resend a refusé la réponse', result.error)
      throw new ServiceError('UNAVAILABLE', "L’email n’a pas pu être envoyé. Rien n’a été enregistré.")
    }
    providerId = result.data?.id ?? null
  } catch (err) {
    if (err instanceof ServiceError) throw err
    console.error('[contact] réponse non envoyée', err)
    throw new ServiceError('UNAVAILABLE', "L’email n’a pas pu être envoyé. Rien n’a été enregistré.")
  }

  const [created] = await prisma.$transaction([
    prisma.contactReply.create({
      data: {
        messageId: input.messageId,
        authorId: input.authorId,
        body: input.body,
        providerId,
      },
    }),
    prisma.contactMessage.update({
      where: { id: input.messageId },
      data: { status: 'answered' },
    }),
  ])

  return { replyId: created.id, providerId }
}

/**
 * Corps de la réponse.
 *
 * Le message d'origine est **cité sous la réponse** : les en-têtes
 * `In-Reply-To` / `References` ne sont pas disponibles, puisque ce qu'on
 * répond n'était pas un email. Sans la citation, le destinataire reçoit une
 * réponse sans savoir à quoi.
 */
function replyHtml(body: string, original: string): string {
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1E5631;">
      <div style="white-space: pre-line;">${escapeHtml(body)}</div>
      <p style="margin-top: 24px;">— L’équipe Growi</p>
      <hr style="border: none; border-top: 1px solid #B4DD7F; margin: 24px 0;" />
      <p style="color: #1E5631; opacity: 0.6; font-size: 13px;">Ton message :</p>
      <blockquote style="margin: 0; padding-left: 12px; border-left: 3px solid #B4DD7F; color: #1E5631; opacity: 0.7; white-space: pre-line; font-size: 13px;">${escapeHtml(original)}</blockquote>
    </div>`
}

/** @throws ServiceError('NOT_FOUND') */
export async function setStatus(id: string, status: ContactMessageStatus) {
  const exists = await prisma.contactMessage.count({ where: { id } })
  if (!exists) throw new ServiceError('NOT_FOUND', 'Message introuvable')

  return prisma.contactMessage.update({ where: { id }, data: { status } })
}

/** @throws ServiceError('NOT_FOUND') */
export async function setInternalNote(id: string, note: string | null) {
  const exists = await prisma.contactMessage.count({ where: { id } })
  if (!exists) throw new ServiceError('NOT_FOUND', 'Message introuvable')

  return prisma.contactMessage.update({
    where: { id },
    data: { internalNote: note?.trim() || null },
  })
}
