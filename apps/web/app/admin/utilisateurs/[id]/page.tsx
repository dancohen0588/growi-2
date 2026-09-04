import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { USER_ROLE_LABELS } from '@growi/shared'

import { AccountStatePill, DateCell, PageHeader, Pill } from '@/components/admin/bits'
import { UserTabs, readTab } from '@/components/admin/UserTabs'
import { ActionsTab } from '@/components/admin/tabs/ActionsTab'
import { ActivityTab } from '@/components/admin/tabs/ActivityTab'
import { AiTab } from '@/components/admin/tabs/AiTab'
import { GardensTab } from '@/components/admin/tabs/GardensTab'
import { PlantsTab } from '@/components/admin/tabs/PlantsTab'
import { ProfileTab } from '@/components/admin/tabs/ProfileTab'
import { requireAdmin } from '@/lib/admin/auth'
import type { SearchParams } from '@/lib/admin/search-params'
import { getUserDetail } from '@/lib/services/admin-user-detail.service'
import { isServiceError } from '@/lib/services/errors'

export const dynamic = 'force-dynamic'

export default async function AdminUserPage({
  params,
  searchParams,
}: {
  params: { id: string }
  searchParams: SearchParams
}) {
  await requireAdmin()

  let user
  try {
    user = await getUserDetail(params.id)
  } catch (err) {
    // Un identifiant qui ne correspond à rien est une 404, pas une erreur :
    // c'est le cas normal quand on suit un lien vers un compte supprimé.
    if (isServiceError(err) && err.code === 'NOT_FOUND') notFound()
    throw err
  }

  const tab = readTab(searchParams)

  return (
    <>
      <Link
        href="/admin/utilisateurs"
        className="mb-4 inline-flex items-center gap-2 text-sm text-forest/60 hover:text-forest"
      >
        <ArrowLeft size={16} aria-hidden />
        Retour à la liste
      </Link>

      <PageHeader
        title={user.displayName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{user.email}</span>
            <span aria-hidden>·</span>
            <span>
              Inscrit le <DateCell value={user.createdAt} />
            </span>
            <span aria-hidden>·</span>
            <span>
              Dernière activité <DateCell value={user.lastSeenAt} withTime fallback="jamais" />
            </span>
          </span>
        }
        actions={
          <>
            <AccountStatePill disabledAt={user.disabledAt} />
            {user.role === 'ADMIN' && <Pill tone="warning">{USER_ROLE_LABELS.ADMIN}</Pill>}
            <Pill>{user.plan}</Pill>
          </>
        }
      />

      <UserTabs
        userId={user.id}
        active={tab}
        params={searchParams}
        counts={{
          jardins: user.counts.gardens,
          plantes: user.counts.plants,
          ia: user.counts.diagnoses + user.counts.conversations,
        }}
      />

      {/* Un seul onglet est rendu, donc une seule série de requêtes : charger
          les six pour n'en montrer qu'un rendrait la fiche d'un compte fourni
          lente alors qu'on ne cherchait qu'un email. */}
      {tab === 'profil' && <ProfileTab user={user} />}
      {tab === 'jardins' && <GardensTab userId={user.id} />}
      {tab === 'plantes' && <PlantsTab userId={user.id} />}
      {tab === 'ia' && <AiTab userId={user.id} />}
      {tab === 'activite' && <ActivityTab userId={user.id} />}
      {tab === 'actions' && <ActionsTab user={user} />}
    </>
  )
}
