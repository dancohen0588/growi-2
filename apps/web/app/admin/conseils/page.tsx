import Link from 'next/link'
import { BLOG_TAG_LABELS, MAX_PENDING_DRAFTS, type BlogPostStatus, type BlogTag } from '@growi/shared'

import {
  generateArticleAction,
  setCadenceAction,
} from '@/app/actions/admin/blog'
import { DateCell, EmptyState, PageHeader, Pill } from '@/components/admin/bits'
import { CadenceSelect } from '@/components/admin/blog/CadenceSelect'
import { GenerateArticleForm } from '@/components/admin/blog/GenerateArticleForm'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { requireAdmin } from '@/lib/admin/auth'
import { buildQuery, readString, type SearchParams } from '@/lib/admin/search-params'
import { MAX_TOPIC_LENGTH } from '@/lib/blog/editorial'
import { getBlogCadence, getLastGenerationAt } from '@/lib/services/app-settings.service'
import { countByStatus, listByStatus, type BlogAdminRow } from '@/lib/services/blog-admin.service'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

/** « Générer un article » tourne dans cette requête : rédaction et image. */
export const maxDuration = 60

/** L'onglet vit dans l'URL, comme les filtres des autres listes de l'admin. */
const TABS: Array<{ key: string; status: BlogPostStatus; label: string }> = [
  { key: 'brouillons', status: 'DRAFT', label: 'Brouillons' },
  { key: 'publies', status: 'PUBLISHED', label: 'Publiés' },
  { key: 'archives', status: 'ARCHIVED', label: 'Archivés' },
]

const ORIGIN_LABELS: Record<string, string> = {
  cron: 'Automatique',
  admin: 'Admin',
  manual: 'Manuel',
}

const COVER_PILLS: Record<string, { label: string; tone: 'positive' | 'warning' | 'neutral' }> = {
  READY: { label: 'Prête', tone: 'positive' },
  PENDING: { label: 'À produire', tone: 'warning' },
  NONE: { label: 'Aucune', tone: 'neutral' },
}

function columns(status: BlogPostStatus): Column<BlogAdminRow>[] {
  return [
    {
      key: 'cover',
      header: <span className="sr-only">Couverture</span>,
      secondary: true,
      cell: (row) => <Thumbnail src={row.coverImage} />,
    },
    {
      key: 'title',
      header: 'Titre',
      cell: (row) => (
        <span className="block max-w-md">
          <span className="block font-medium">{row.title}</span>
          <span className="block text-xs font-normal text-forest/50">/{row.slug}</span>
        </span>
      ),
    },
    {
      key: 'tags',
      header: 'Tags',
      secondary: true,
      cell: (row) => (
        <span className="flex flex-wrap gap-1">
          {row.tags.map((tag) => (
            <Pill key={tag}>{BLOG_TAG_LABELS[tag as BlogTag] ?? tag}</Pill>
          ))}
        </span>
      ),
    },
    {
      key: 'origin',
      header: 'Origine',
      secondary: true,
      cell: (row) => ORIGIN_LABELS[row.origin] ?? row.origin,
    },
    {
      key: 'date',
      header: status === 'PUBLISHED' ? 'Publié le' : 'Modifié le',
      cell: (row) => <DateCell value={status === 'PUBLISHED' ? row.publishedAt : row.updatedAt} />,
    },
    {
      key: 'coverStatus',
      header: 'Couverture',
      cell: (row) => {
        const pill = COVER_PILLS[row.coverStatus] ?? COVER_PILLS.NONE
        return <Pill tone={pill.tone}>{pill.label}</Pill>
      },
    },
  ]
}

export default async function AdminConseilsPage({ searchParams }: { searchParams: SearchParams }) {
  await requireAdmin()

  const tab = TABS.find((candidate) => candidate.key === readString(searchParams, 'statut')) ?? TABS[0]

  const [rows, counts, cadence, lastGeneration] = await Promise.all([
    listByStatus(tab.status),
    countByStatus(),
    getBlogCadence(),
    getLastGenerationAt(),
  ])

  const capReached = counts.DRAFT >= MAX_PENDING_DRAFTS

  return (
    <>
      <PageHeader
        title="Conseils"
        description={
          <>
            Les articles du blog. Un brouillon ne se voit nulle part tant qu’il n’est pas publié ;
            chacun arrive avec la liste de ce qu’il faut vérifier avant.
          </>
        }
      />

      <section
        aria-label="Génération"
        className="mb-6 flex flex-col gap-4 rounded-2xl border border-forest/10 bg-white p-4 lg:flex-row lg:items-start lg:justify-between"
      >
        <GenerateArticleForm
          action={generateArticleAction}
          maxTopicLength={MAX_TOPIC_LENGTH}
          disabledReason={
            capReached
              ? `${counts.DRAFT} brouillons attendent déjà une relecture : publie-les ou supprime-les pour en générer un autre.`
              : undefined
          }
        />
        <div className="flex flex-col gap-1">
          <CadenceSelect value={cadence} action={setCadenceAction} />
          <p className="text-xs text-forest/50">
            Passage chaque lundi à 7 h UTC (9 h à Paris l’été, 8 h l’hiver).{' '}
            {lastGeneration ? (
              <>
                Dernière génération automatique : <DateCell value={lastGeneration} />.
              </>
            ) : (
              'Aucune génération automatique encore.'
            )}
          </p>
        </div>
      </section>

      <nav aria-label="Statut des articles" className="mb-4 flex gap-1 overflow-x-auto border-b border-forest/10">
        {TABS.map((candidate) => {
          const active = candidate.key === tab.key
          return (
            <Link
              key={candidate.key}
              href={`/admin/conseils${buildQuery(searchParams, { statut: candidate.key })}`}
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
        columns={columns(tab.status)}
        rowKey={(row) => row.id}
        rowHref={(row) => `/admin/conseils/${row.id}`}
        caption={tab.label}
        empty={
          <EmptyState
            title={tab.status === 'DRAFT' ? 'Aucun brouillon en attente' : `Aucun article ${tab.label.toLowerCase()}`}
            hint={tab.status === 'DRAFT' ? 'Les articles générés arriveront ici pour relecture.' : undefined}
          />
        }
      />
    </>
  )
}

/** Vignette 16:9, ou le dégradé qu'affiche aussi la carte publique sans image. */
function Thumbnail({ src }: { src: string | null }) {
  return (
    <span className="block h-9 w-16 overflow-hidden rounded-md bg-gradient-to-br from-forest to-lime">
      {src && (
        // eslint-disable-next-line @next/next/no-img-element -- vignette de 64 px, next/image n'y gagne rien
        <img src={src} alt="" className="h-full w-full object-cover" loading="lazy" />
      )}
    </span>
  )
}
