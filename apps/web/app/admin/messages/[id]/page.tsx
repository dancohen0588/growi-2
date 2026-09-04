import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import {
  CONTACT_MESSAGE_SOURCE_LABELS,
  CONTACT_MESSAGE_STATUS_LABELS,
  type ContactMessageSource,
  type ContactMessageStatus,
} from '@growi/shared'

import {
  replyToMessageAction,
  setInternalNoteAction,
  setMessageStatusAction,
} from '@/app/actions/admin/messages'
import { ActionButton } from '@/components/admin/ActionButton'
import { DateCell, PageHeader, Pill } from '@/components/admin/bits'
import { InternalNoteForm, ReplyComposer } from '@/components/admin/MessageThread'
import { requireAdmin } from '@/lib/admin/auth'
import { displayNameOf } from '@/lib/admin/serializers'
import { get, isMailConfigured, subjectLabel } from '@/lib/services/contact.service'
import { isServiceError } from '@/lib/services/errors'

export const dynamic = 'force-dynamic'

const STATUS_TONES: Record<ContactMessageStatus, 'warning' | 'positive' | 'neutral'> = {
  new: 'warning',
  answered: 'positive',
  archived: 'neutral',
}

export default async function AdminMessagePage({ params }: { params: { id: string } }) {
  await requireAdmin()

  let message
  try {
    message = await get(params.id)
  } catch (err) {
    if (isServiceError(err) && err.code === 'NOT_FOUND') notFound()
    throw err
  }

  const label = subjectLabel(message.subject, message.otherSubject)
  const sender = [message.firstName, message.lastName].filter(Boolean).join(' ') || message.email
  const mailReady = isMailConfigured()
  const archived = message.status === 'archived'

  return (
    <>
      <Link
        href="/admin/messages"
        className="mb-4 inline-flex items-center gap-2 text-sm text-forest/60 hover:text-forest"
      >
        <ArrowLeft size={16} aria-hidden />
        Retour à la boîte
      </Link>

      <PageHeader
        title={label}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{sender}</span>
            <span aria-hidden>·</span>
            <a href={`mailto:${message.email}`} className="underline hover:no-underline">
              {message.email}
            </a>
            {message.phone && (
              <>
                <span aria-hidden>·</span>
                <span>{message.phone}</span>
              </>
            )}
          </span>
        }
        actions={
          <>
            <Pill tone={STATUS_TONES[message.status as ContactMessageStatus] ?? 'neutral'}>
              {CONTACT_MESSAGE_STATUS_LABELS[message.status as ContactMessageStatus] ??
                message.status}
            </Pill>
            <Pill>
              {CONTACT_MESSAGE_SOURCE_LABELS[message.source as ContactMessageSource] ??
                message.source}
            </Pill>
            {!message.notifiedAt && <Pill tone="danger">Non notifié</Pill>}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <article className="rounded-2xl border border-forest/10 bg-white p-6">
            <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="font-poppins text-base font-semibold text-forest">Message reçu</h2>
              <DateCell value={message.createdAt} withTime />
            </header>
            <p className="whitespace-pre-line text-forest/85">{message.body}</p>
          </article>

          {message.replies.map((reply) => (
            <article
              key={reply.id}
              className="rounded-2xl border border-lime/40 bg-lime/10 p-6"
            >
              <header className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-poppins text-base font-semibold text-forest">
                  Réponse envoyée
                </h3>
                <DateCell value={reply.sentAt} withTime />
              </header>
              <p className="whitespace-pre-line text-forest/85">{reply.body}</p>
            </article>
          ))}

          <section className="rounded-2xl border border-forest/10 bg-white p-6">
            <h2 className="mb-4 font-poppins text-base font-semibold text-forest">Répondre</h2>
            <ReplyComposer
              action={replyToMessageAction.bind(null, message.id)}
              quotedSubject={label}
              disabled={!mailReady}
              disabledReason={`Envoi indisponible : réponds depuis info@growi-garden.fr.`}
            />
          </section>
        </div>

        <aside className="space-y-6">
          <section className="rounded-2xl border border-forest/10 bg-white p-6">
            <h2 className="mb-4 font-poppins text-base font-semibold text-forest">Le compte</h2>
            {message.user ? (
              <dl className="space-y-2 text-sm">
                <Row label="Nom">{displayNameOf(message.user)}</Row>
                <Row label="Inscrit le">
                  <DateCell value={message.user.createdAt} />
                </Row>
                <Row label="Dernière activité">
                  <DateCell value={message.user.lastSeenAt} withTime fallback="Aucune trace" />
                </Row>
                <Row label="Jardins / plantes">
                  {message.user._count.gardens} / {message.user._count.plantInstances}
                </Row>
                {message.user.disabledAt && (
                  <Row label="État">
                    <Pill tone="danger">Désactivé</Pill>
                  </Row>
                )}
                <div className="pt-2">
                  <Link
                    href={`/admin/utilisateurs/${message.user.id}`}
                    className="text-sm text-forest underline hover:no-underline"
                  >
                    Ouvrir la fiche
                  </Link>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-forest/55">
                Aucun compte Growi ne porte cette adresse. Le rattachement se fait à la réception,
                sans tenir compte de la casse.
              </p>
            )}
          </section>

          <section className="rounded-2xl border border-forest/10 bg-white p-6">
            <h2 className="mb-1 font-poppins text-base font-semibold text-forest">Note interne</h2>
            <p className="mb-3 text-sm text-forest/55">Jamais envoyée à l’expéditeur.</p>
            <InternalNoteForm
              action={setInternalNoteAction.bind(null, message.id)}
              defaultValue={message.internalNote ?? ''}
            />
          </section>

          <section className="rounded-2xl border border-forest/10 bg-white p-6">
            <h2 className="mb-4 font-poppins text-base font-semibold text-forest">Classement</h2>
            <ActionButton
              label={archived ? 'Rouvrir' : 'Archiver'}
              description={
                archived
                  ? 'Le message revient dans la boîte.'
                  : 'Le message sort de la boîte, sans être supprimé.'
              }
              action={setMessageStatusAction.bind(
                null,
                message.id,
                archived ? (message.replies.length > 0 ? 'answered' : 'new') : 'archived',
              )}
            />
          </section>
        </aside>
      </div>
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-3">
      <dt className="text-forest/55">{label}</dt>
      <dd className="text-right text-forest/85">{children}</dd>
    </div>
  )
}
