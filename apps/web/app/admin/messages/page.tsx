import Link from 'next/link'
import {
  CONTACT_MESSAGE_SOURCE_LABELS,
  CONTACT_MESSAGE_SOURCES,
  CONTACT_MESSAGE_STATUS_LABELS,
  CONTACT_MESSAGE_STATUSES,
  type ContactMessageSource,
  type ContactMessageStatus,
} from '@growi/shared'

import { DateCell, EmptyState, PageHeader, Pill } from '@/components/admin/bits'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { MessageFilters } from '@/components/admin/MessageFilters'
import { requireAdmin } from '@/lib/admin/auth'
import {
  buildQuery,
  encodeCursor,
  readCursor,
  readString,
  type SearchParams,
} from '@/lib/admin/search-params'
import {
  countMessages,
  isMailConfigured,
  list,
  subjectLabel,
} from '@/lib/services/contact.service'

export const dynamic = 'force-dynamic'

type Row = Awaited<ReturnType<typeof list>>['messages'][number]

const STATUS_TONES: Record<ContactMessageStatus, 'warning' | 'positive' | 'neutral'> = {
  new: 'warning',
  answered: 'positive',
  archived: 'neutral',
}

const columns: Column<Row>[] = [
  {
    key: 'from',
    header: 'Expéditeur',
    cell: (row) => (
      <span className="block">
        <span className="block">
          {[row.firstName, row.lastName].filter(Boolean).join(' ') || row.email}
        </span>
        <span className="block text-xs font-normal text-forest/50">{row.email}</span>
      </span>
    ),
  },
  {
    key: 'account',
    header: 'Compte',
    cell: (row) =>
      row.userId ? (
        // Le lien vers la fiche : savoir à qui on parle change ce qu'on répond.
        <Link
          href={`/admin/utilisateurs/${row.userId}`}
          className="text-forest underline hover:no-underline"
        >
          Voir la fiche
        </Link>
      ) : (
        <span className="text-forest/30">Pas de compte</span>
      ),
  },
  {
    key: 'subject',
    header: 'Sujet',
    cell: (row) => subjectLabel(row.subject, row.otherSubject),
  },
  {
    key: 'extract',
    header: 'Extrait',
    secondary: true,
    cell: (row) => <span className="line-clamp-2 max-w-md text-forest/70">{row.body}</span>,
  },
  {
    key: 'source',
    header: 'Source',
    secondary: true,
    cell: (row) => (
      <Pill>
        {CONTACT_MESSAGE_SOURCE_LABELS[row.source as ContactMessageSource] ?? row.source}
      </Pill>
    ),
  },
  {
    key: 'status',
    header: 'Statut',
    cell: (row) => (
      <span className="flex flex-wrap items-center gap-1.5">
        <Pill tone={STATUS_TONES[row.status as ContactMessageStatus] ?? 'neutral'}>
          {CONTACT_MESSAGE_STATUS_LABELS[row.status as ContactMessageStatus] ?? row.status}
        </Pill>
        {row._count.replies > 0 && (
          <span className="text-xs text-forest/50">{row._count.replies} rép.</span>
        )}
        {/* Un message non notifié est arrivé quand même — mais personne n'a
            reçu d'alerte. C'est exactement ce qu'il faut voir d'un coup d'œil. */}
        {!row.notifiedAt && <Pill tone="danger">Non notifié</Pill>}
      </span>
    ),
  },
  {
    key: 'date',
    header: 'Reçu le',
    cell: (row) => <DateCell value={row.createdAt} withTime />,
  },
]

export default async function AdminMessagesPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireAdmin()

  const status = readString(searchParams, 'statut')
  const source = readString(searchParams, 'source')

  const filters = {
    status: CONTACT_MESSAGE_STATUSES.includes(status as ContactMessageStatus)
      ? (status as ContactMessageStatus)
      : undefined,
    source: CONTACT_MESSAGE_SOURCES.includes(source as ContactMessageSource)
      ? (source as ContactMessageSource)
      : undefined,
    subject: readString(searchParams, 'sujet'),
    search: readString(searchParams, 'q'),
  }
  const cursor = readCursor(searchParams)

  const [{ messages, nextCursor }, total] = await Promise.all([
    list(filters, cursor),
    countMessages(filters),
  ])

  return (
    <>
      <PageHeader
        title="Messages"
        description="Les messages du formulaire de contact et les inscriptions à la bêta iOS."
      />

      {!isMailConfigured() && (
        <p
          role="status"
          className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          <strong>Envoi indisponible.</strong> `RESEND_API_KEY` n’est pas renseignée : les
          messages continuent d’arriver et d’être conservés, mais aucune notification ne part et
          il est impossible de répondre depuis ici.
        </p>
      )}

      <MessageFilters params={searchParams} total={total} />

      <DataTable
        rows={messages}
        columns={columns}
        rowKey={(row) => row.id}
        rowHref={(row) => `/admin/messages/${row.id}`}
        caption="Boîte de réception"
        empty={
          <EmptyState
            title="Aucun message"
            hint="Les messages du formulaire de contact arriveront ici."
          />
        }
        nextHref={
          nextCursor
            ? `/admin/messages${buildQuery(searchParams, { apres: encodeCursor(nextCursor) })}`
            : null
        }
        resetHref={cursor ? `/admin/messages${buildQuery(searchParams, { apres: undefined })}` : null}
      />
    </>
  )
}
