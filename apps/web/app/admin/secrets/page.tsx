import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { SecretStatus } from '@growi/shared'

import { DateCell, EmptyState, PageHeader } from '@/components/admin/bits'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { EvidencePill } from '@/components/admin/secrets/EvidencePill'
import { Ratio, VerdictSummary } from '@/components/admin/secrets/TipStats'
import { requireAdmin } from '@/lib/admin/auth'
import { buildQuery, readString, type SearchParams } from '@/lib/admin/search-params'
import { countTipsByStatus, listTipsByStatus, type TipAdminRow } from '@/lib/services/secrets-admin.service'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/** L'onglet vit dans l'URL (`?statut=`), comme sur `/admin/conseils`. */
const TABS: Array<{ key: string; status: SecretStatus; label: string }> = [
  { key: 'publies', status: 'PUBLISHED', label: 'Publiés' },
  { key: 'brouillons', status: 'DRAFT', label: 'Brouillons' },
]

const columns: Column<TipAdminRow>[] = [
  {
    key: 'title',
    header: 'Secret',
    cell: (row) => (
      <span className="block max-w-xs">
        <span className="block font-medium">{row.title}</span>
        <span className="block text-xs font-normal text-forest/50">{row.slug}</span>
      </span>
    ),
  },
  { key: 'evidence', header: 'Preuve', cell: (row) => <EvidencePill evidence={row.evidence} /> },
  { key: 'picked', header: 'Tiré', cell: (row) => row.stats.picked },
  {
    key: 'revealed',
    header: 'Dévoilé',
    cell: (row) => <Ratio part={row.stats.revealed} whole={row.stats.picked} unit="" />,
  },
  {
    key: 'tried',
    header: 'Essayé',
    cell: (row) => <Ratio part={row.stats.tried} whole={row.stats.picked} unit="" />,
  },
  {
    key: 'dismissed',
    header: 'Refusé',
    secondary: true,
    cell: (row) => <Ratio part={row.stats.dismissed} whole={row.stats.picked} unit="" />,
  },
  { key: 'verdicts', header: 'Verdicts', secondary: true, cell: (row) => <VerdictSummary stats={row.stats} /> },
  { key: 'updated', header: 'Modifié le', secondary: true, cell: (row) => <DateCell value={row.updatedAt} /> },
]

export default async function AdminSecretsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin()

  const tab = TABS.find((candidate) => candidate.key === readString(searchParams, 'statut')) ?? TABS[0]
  const [rows, counts] = await Promise.all([listTipsByStatus(tab.status), countTipsByStatus()])

  return (
    <>
      <PageHeader
        title="Secrets de jardinier"
        description={
          <>
            La bibliothèque des astuces de tradition que le planning propose, une par semaine et par jardin.
            Un brouillon n’est jamais tiré. Dévoilé, essayé et refusé sont rapportés au nombre de tirages.
          </>
        }
        actions={
          <Link
            href="/admin/secrets/nouveau"
            className="inline-flex items-center gap-2 rounded-lg bg-forest px-4 py-2 text-sm font-medium text-white hover:bg-forest/90"
          >
            <Plus size={15} aria-hidden /> Nouveau secret
          </Link>
        }
      />

      <nav aria-label="Statut des secrets" className="mb-4 flex gap-1 overflow-x-auto border-b border-forest/10">
        {TABS.map((candidate) => {
          const active = candidate.key === tab.key
          return (
            <Link
              key={candidate.key}
              href={`/admin/secrets${buildQuery(searchParams, { statut: candidate.key })}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'shrink-0 whitespace-nowrap border-b-2 px-4 py-2.5 font-raleway text-sm transition-colors',
                active ? 'border-lime font-semibold text-forest' : 'border-transparent text-forest/55 hover:text-forest',
              )}
            >
              {candidate.label}
              <span className="ml-2 text-xs text-forest/40">{counts[candidate.status]}</span>
            </Link>
          )
        })}
      </nav>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        rowHref={(row) => `/admin/secrets/${row.id}`}
        caption={tab.label}
        empty={
          <EmptyState
            title={tab.status === 'DRAFT' ? 'Aucun brouillon' : 'Aucun secret publié'}
            hint={tab.status === 'DRAFT' ? 'Un secret créé ou dépublié arrive ici.' : 'Le planning ne proposera aucun secret.'}
          />
        }
      />
    </>
  )
}
