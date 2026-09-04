import Link from 'next/link'

import { DateCell, EmptyState, PageHeader, Pill } from '@/components/admin/bits'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { AuditFilters } from '@/components/admin/AuditFilters'
import { requireAdmin } from '@/lib/admin/auth'
import {
  buildQuery,
  encodeCursor,
  readAuditCursor,
  readAuditFilters,
  type SearchParams,
} from '@/lib/admin/search-params'
import type { AdminAuditRow } from '@/lib/admin/serializers'
import { listAuditActors, listAuditEntries } from '@/lib/services/admin-audit.service'

export const dynamic = 'force-dynamic'

/**
 * Certaines actions ne visent pas une entité mais une **sélection** — l'export
 * CSV porte sur la liste filtrée. Elles écrivent `liste` comme identifiant, et
 * n'ont donc ni fiche à ouvrir ni identifiant à afficher : « Utilisateur liste »
 * ne veut rien dire pour qui relit le journal.
 */
const COLLECTION_TARGET_ID = 'liste'

function targetHref(row: AdminAuditRow): string | null {
  if (row.targetId === COLLECTION_TARGET_ID) return null
  if (row.targetType === 'user') return `/admin/utilisateurs/${row.targetId}`
  if (row.targetType === 'contact_message') return `/admin/messages/${row.targetId}`
  return null
}

function targetLabel(row: AdminAuditRow): string {
  return row.targetId === COLLECTION_TARGET_ID
    ? 'Sélection filtrée'
    : `${row.targetLabel} ${row.targetId}`
}

const columns: Column<AdminAuditRow>[] = [
  {
    key: 'date',
    header: 'Date',
    cell: (row) => <DateCell value={row.createdAt} withTime />,
  },
  {
    key: 'actor',
    header: 'Acteur',
    cell: (row) =>
      row.actor ? (
        <span className="block">
          <span className="block">{row.actor.displayName}</span>
          <span className="block text-xs text-forest/50">{row.actor.email}</span>
        </span>
      ) : (
        <span className="text-forest/30">Compte supprimé</span>
      ),
  },
  {
    key: 'action',
    header: 'Action',
    cell: (row) => <Pill>{row.actionLabel}</Pill>,
  },
  {
    key: 'target',
    header: 'Cible',
    cell: (row) => {
      const href = targetHref(row)
      const label = targetLabel(row)
      return href ? (
        <Link href={href} className="text-forest hover:underline">
          {label}
        </Link>
      ) : (
        <span className="text-forest/60">{label}</span>
      )
    },
  },
  {
    key: 'details',
    header: 'Détails',
    secondary: true,
    cell: (row) =>
      row.details ? (
        <details className="max-w-md">
          <summary className="cursor-pointer text-sm text-forest/60 hover:text-forest">
            Voir
          </summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-sand p-3 text-xs text-forest/80">
            {JSON.stringify(row.details, null, 2)}
          </pre>
        </details>
      ) : (
        <span className="text-forest/30">—</span>
      ),
  },
]

export default async function AdminJournalPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireAdmin()

  const filters = readAuditFilters(searchParams)
  const cursor = readAuditCursor(searchParams)

  const [{ entries, nextCursor }, actors] = await Promise.all([
    listAuditEntries(filters, cursor),
    listAuditActors(),
  ])

  return (
    <>
      <PageHeader
        title="Journal"
        description="Toutes les actions d’administration, dans l’ordre où elles ont eu lieu. Le journal ne se modifie pas."
      />

      <AuditFilters params={searchParams} actors={actors} />

      <DataTable
        rows={entries}
        columns={columns}
        rowKey={(row) => row.id}
        caption="Journal des actions d’administration"
        empty={
          <EmptyState
            title="Aucune action journalisée"
            hint="Le journal se remplit dès la première action d’administration."
          />
        }
        nextHref={
          nextCursor
            ? `/admin/journal${buildQuery(searchParams, { apres: encodeCursor(nextCursor) })}`
            : null
        }
        resetHref={cursor ? `/admin/journal${buildQuery(searchParams, { apres: undefined })}` : null}
      />
    </>
  )
}
