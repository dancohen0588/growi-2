import Link from 'next/link'
import { Download } from 'lucide-react'
import { USER_ROLE_LABELS } from '@growi/shared'

import { AccountStatePill, DateCell, EmptyState, PageHeader, Pill } from '@/components/admin/bits'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { UserFilters } from '@/components/admin/UserFilters'
import { requireAdmin } from '@/lib/admin/auth'
import {
  buildQuery,
  encodeCursor,
  readUserCursor,
  readUserFilters,
  type SearchParams,
} from '@/lib/admin/search-params'
import type { AdminUserRow } from '@/lib/admin/serializers'
import { countUsers, listUserPlans, listUsers } from '@/lib/services/admin-user.service'

export const dynamic = 'force-dynamic'

const columns: Column<AdminUserRow>[] = [
  {
    key: 'name',
    header: 'Compte',
    cell: (user) => (
      <span className="block">
        <span className="block">{user.displayName}</span>
        <span className="block text-xs font-normal text-forest/50">{user.email}</span>
      </span>
    ),
  },
  {
    key: 'created',
    header: 'Inscription',
    cell: (user) => <DateCell value={user.createdAt} />,
  },
  {
    key: 'lastSeen',
    header: 'Dernière activité',
    cell: (user) => <DateCell value={user.lastSeenAt} withTime fallback="Jamais vu" />,
  },
  {
    key: 'gardens',
    header: 'Jardins',
    cell: (user) => user.gardens,
    secondary: true,
    className: 'text-right tabular-nums',
  },
  {
    key: 'plants',
    header: 'Plantes',
    cell: (user) => user.plants,
    secondary: true,
    className: 'text-right tabular-nums',
  },
  {
    key: 'plan',
    header: 'Plan',
    cell: (user) => <Pill>{user.plan}</Pill>,
    secondary: true,
  },
  {
    key: 'role',
    header: 'Rôle',
    cell: (user) =>
      user.role === 'ADMIN' ? (
        <Pill tone="warning">{USER_ROLE_LABELS.ADMIN}</Pill>
      ) : (
        <span className="text-forest/40">{USER_ROLE_LABELS.USER}</span>
      ),
  },
  {
    key: 'state',
    header: 'État',
    cell: (user) => <AccountStatePill disabledAt={user.disabledAt} />,
  },
]

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  await requireAdmin()

  const filters = readUserFilters(searchParams)
  const cursor = readUserCursor(searchParams)

  const [{ users, nextCursor }, total, plans] = await Promise.all([
    listUsers(filters, cursor),
    countUsers(filters),
    listUserPlans(),
  ])

  return (
    <>
      <PageHeader
        title="Utilisateurs"
        description="Les comptes Growi, leurs jardins et leur activité."
        actions={
          <Link
            href={`/admin/utilisateurs/export${buildQuery(searchParams, { apres: undefined })}`}
            // Un téléchargement, pas une navigation : on sort du routeur client,
            // sinon Next tenterait d'en faire un rendu de page.
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-lg border border-forest/15 bg-white px-4 py-2 text-sm font-medium text-forest hover:bg-sand"
          >
            <Download size={16} aria-hidden />
            Exporter en CSV
          </Link>
        }
      />

      <UserFilters params={searchParams} plans={plans} total={total} />

      <DataTable
        rows={users}
        columns={columns}
        rowKey={(user) => user.id}
        rowHref={(user) => `/admin/utilisateurs/${user.id}`}
        caption="Liste des comptes Growi"
        empty={
          <EmptyState
            title="Aucun compte ne correspond"
            hint="Élargis la recherche ou efface les filtres."
          />
        }
        nextHref={
          nextCursor
            ? `/admin/utilisateurs${buildQuery(searchParams, { apres: encodeCursor(nextCursor) })}`
            : null
        }
        resetHref={
          cursor ? `/admin/utilisateurs${buildQuery(searchParams, { apres: undefined })}` : null
        }
      />
    </>
  )
}
