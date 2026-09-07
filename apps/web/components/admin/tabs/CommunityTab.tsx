import Link from 'next/link'
import {
  LISTING_CATEGORY_LABELS,
  LISTING_KIND_LABELS,
  LISTING_STATUS_LABELS,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  REPORT_TARGET_LABELS,
  type ListingCategory,
  type ListingKind,
  type ListingStatus,
  type ReportReason,
  type ReportStatus,
  type ReportTarget,
} from '@growi/shared'

import { DateCell, EmptyState, Pill } from '@/components/admin/bits'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { getUserCommunity } from '@/lib/services/admin-user-detail.service'

/**
 * Onglet « Communauté » de la fiche d'un compte.
 *
 * Ce qu'il sert à décider : faut-il masquer un contenu, ou désactiver le
 * compte. D'où l'ordre — le profil public d'abord, puis ce qu'on lui reproche,
 * et ses contenus en dernier.
 *
 * Les contenus supprimés par leur auteur n'y figurent pas : ils n'existent plus
 * pour personne. Les contenus **masqués**, si — c'est précisément ce qu'on
 * vient vérifier.
 */

type Data = Awaited<ReturnType<typeof getUserCommunity>>
type Post = Data['posts'][number]
type Listing = Data['listings'][number]
type Report = Data['reports'][number]

function statusTone(status: string): 'positive' | 'warning' | 'danger' | 'neutral' {
  if (status === 'hidden') return 'danger'
  if (status === 'reserved' || status === 'expired') return 'warning'
  if (status === 'visible' || status === 'active' || status === 'done') return 'positive'
  return 'neutral'
}

const postColumns: Column<Post>[] = [
  { key: 'date', header: 'Publiée le', cell: (row) => <DateCell value={row.createdAt} withTime /> },
  {
    key: 'body',
    header: 'Texte',
    cell: (row) => (
      <span className="line-clamp-2 max-w-md text-forest/70">{row.body || '(sans texte)'}</span>
    ),
  },
  {
    key: 'photos',
    header: 'Photos',
    secondary: true,
    // La colonne est en Json : ce qui en sort n'est typé par rien.
    cell: (row) => (Array.isArray(row.photos) ? row.photos.length : 0),
  },
  {
    key: 'reactions',
    header: 'Réactions',
    secondary: true,
    cell: (row) => `${row.likeCount} ♥ · ${row.commentCount} 💬`,
  },
  {
    key: 'status',
    header: 'Statut',
    cell: (row) => <Pill tone={statusTone(row.status)}>{row.status}</Pill>,
  },
  {
    key: 'link',
    header: '',
    cell: (row) => (
      <Link href={`/p/${row.id}`} className="text-forest underline hover:no-underline">
        Voir
      </Link>
    ),
  },
]

const listingColumns: Column<Listing>[] = [
  { key: 'date', header: 'Publiée le', cell: (row) => <DateCell value={row.createdAt} /> },
  {
    key: 'title',
    header: 'Annonce',
    cell: (row) => (
      <span className="block">
        <span className="block">{row.title}</span>
        <span className="block text-xs font-normal text-forest/50">
          {LISTING_KIND_LABELS[row.kind as ListingKind] ?? row.kind} ·{' '}
          {LISTING_CATEGORY_LABELS[row.category as ListingCategory] ?? row.category}
        </span>
      </span>
    ),
  },
  {
    key: 'threads',
    header: 'Intéressés',
    secondary: true,
    cell: (row) => row.threadCount,
  },
  {
    key: 'expires',
    header: 'Expire le',
    secondary: true,
    cell: (row) => <DateCell value={row.expiresAt} />,
  },
  {
    key: 'status',
    header: 'Statut',
    cell: (row) => (
      <Pill tone={statusTone(row.status)}>
        {LISTING_STATUS_LABELS[row.status as ListingStatus] ?? row.status}
      </Pill>
    ),
  },
]

const reportColumns: Column<Report>[] = [
  { key: 'date', header: 'Reçu le', cell: (row) => <DateCell value={row.createdAt} withTime /> },
  {
    key: 'target',
    header: 'Porte sur',
    cell: (row) => REPORT_TARGET_LABELS[row.targetType as ReportTarget] ?? row.targetType,
  },
  {
    key: 'reason',
    header: 'Motif',
    cell: (row) => <Pill>{REPORT_REASON_LABELS[row.reason as ReportReason] ?? row.reason}</Pill>,
  },
  {
    key: 'note',
    header: 'Note',
    secondary: true,
    cell: (row) => <span className="line-clamp-2 max-w-md text-forest/70">{row.note ?? '—'}</span>,
  },
  {
    key: 'status',
    header: 'Suite',
    cell: (row) => (
      <Pill tone={row.status === 'open' ? 'warning' : 'neutral'}>
        {REPORT_STATUS_LABELS[row.status as ReportStatus] ?? row.status}
      </Pill>
    ),
  },
]

export async function CommunityTab({ userId }: { userId: string }) {
  const { profile, posts, listings, reports } = await getUserCommunity(userId)

  if (!profile?.communityEnabled) {
    return (
      <EmptyState
        title="Pas de profil public"
        hint="Ce compte n’a pas rejoint la communauté. Il n’a donc ni pseudo, ni publication, ni annonce."
      />
    )
  }

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-poppins text-lg font-semibold text-forest">Profil public</h2>
        <dl className="grid gap-4 rounded-2xl border border-forest/10 bg-white p-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-forest/50">Pseudo</dt>
            <dd>
              <Link
                href={`/u/${profile.handle}`}
                className="text-forest underline hover:no-underline"
              >
                {profile.handle}
              </Link>
            </dd>
          </div>
          <div>
            <dt className="text-forest/50">Activé le</dt>
            <dd>
              {profile.communityEnabledAt ? (
                <DateCell value={profile.communityEnabledAt} />
              ) : (
                <span className="text-forest/30">—</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-forest/50">Rayon</dt>
            <dd>{profile.communityRadiusKm} km</dd>
          </div>
          <div>
            <dt className="text-forest/50">Abonnés · abonnements</dt>
            <dd>
              {profile.followerCount} · {profile.followingCount}
            </dd>
          </div>
          <div>
            <dt className="text-forest/50">Position publiée</dt>
            {/* La position **floutée**, à ~1 km près : c'est elle que voient
                les autres, et donc elle qu'on vient vérifier ici. */}
            <dd>
              {profile.fuzzyLat !== null && profile.fuzzyLng !== null ? (
                `${profile.fuzzyLat.toFixed(3)}, ${profile.fuzzyLng.toFixed(3)} (floutée)`
              ) : (
                <span className="text-forest/30">Aucune</span>
              )}
            </dd>
          </div>
          <div className="sm:col-span-3">
            <dt className="text-forest/50">Présentation</dt>
            <dd className="text-forest/80">{profile.bio || '—'}</dd>
          </div>
        </dl>
      </section>

      <section>
        <h2 className="mb-3 font-poppins text-lg font-semibold text-forest">
          Signalements reçus
        </h2>
        <DataTable
          rows={reports}
          columns={reportColumns}
          rowKey={(row) => row.id}
          caption="Signalements visant ce compte ou ses publications"
          empty={
            <EmptyState
              title="Aucun signalement"
              hint="Ni ce compte ni ses publications n’ont été signalés."
            />
          }
        />
      </section>

      <section>
        <h2 className="mb-3 font-poppins text-lg font-semibold text-forest">Publications</h2>
        <DataTable
          rows={posts}
          columns={postColumns}
          rowKey={(row) => row.id}
          caption="Publications, hors celles supprimées par leur auteur"
          empty={<EmptyState title="Aucune publication" />}
        />
      </section>

      <section>
        <h2 className="mb-3 font-poppins text-lg font-semibold text-forest">Annonces</h2>
        <DataTable
          rows={listings}
          columns={listingColumns}
          rowKey={(row) => row.id}
          caption="Annonces de la bourse, hors celles supprimées par leur auteur"
          empty={<EmptyState title="Aucune annonce" />}
        />
      </section>
    </div>
  )
}
