import Link from 'next/link'
import {
  REPORT_REASON_LABELS,
  REPORT_TARGET_LABELS,
  type ReportReason,
  type ReportTarget,
} from '@growi/shared'

import { dismissReportsAction, moderateContentAction } from '@/app/actions/admin/moderation'
import { ActionButton } from '@/components/admin/ActionButton'
import { DateCell, EmptyState, PageHeader, Pill } from '@/components/admin/bits'
import { requireAdmin } from '@/lib/admin/auth'
import { listOpenReports, type ReportGroup } from '@/lib/services/community/moderation.service'

export const dynamic = 'force-dynamic'

/**
 * File de modération.
 *
 * **Groupée par contenu, pas par signalement** : trois personnes qui signalent
 * la même photo, c'est une décision à prendre, pas trois. Et triée par nombre
 * de signalements plutôt que par date — un contenu que trois voisins ont
 * signalé passe avant un signalement isolé.
 *
 * Pas de page de détail : tout ce qui sert à décider — l'extrait, l'auteur,
 * les motifs, les notes — tient dans la carte. Un second écran n'ajouterait
 * qu'un clic entre le problème et sa réponse. (Écart assumé avec la spec, qui
 * prévoyait `signalements/[id]`.)
 */

/** Les motifs, comptés — « Spam ×3 » se lit mieux que trois fois « Spam ». */
function countReasons(reasons: string[]): { label: string; count: number }[] {
  const tally = new Map<string, number>()
  for (const reason of reasons) {
    tally.set(reason, (tally.get(reason) ?? 0) + 1)
  }

  return [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({
      label: REPORT_REASON_LABELS[reason as ReportReason] ?? reason,
      count,
    }))
}

function statusTone(status: string | null): 'neutral' | 'warning' | 'danger' | 'positive' {
  if (status === 'hidden') return 'danger'
  if (status === 'deleted' || status === 'expired') return 'neutral'
  return 'positive'
}

function ReportCard({ group }: { group: ReportGroup }) {
  const label = REPORT_TARGET_LABELS[group.targetType as ReportTarget] ?? group.targetType
  // Un compte et un message privé ne se masquent pas : le premier se désactive
  // depuis sa fiche, le second n'est pas lisible par l'administration.
  const canHide = ['post', 'comment', 'listing'].includes(group.targetType)

  return (
    <article className="rounded-2xl border border-forest/10 bg-white p-4">
      <header className="mb-3 flex flex-wrap items-center gap-2">
        <Pill>{label}</Pill>
        <Pill tone={group.count >= 3 ? 'danger' : 'warning'}>
          {group.count} signalement{group.count > 1 ? 's' : ''}
        </Pill>
        {group.status && <Pill tone={statusTone(group.status)}>{group.status}</Pill>}
        <span className="ml-auto text-sm text-forest/50">
          <DateCell value={group.firstReportedAt} withTime />
        </span>
      </header>

      {group.preview === null ? (
        <p className="mb-3 text-sm italic text-forest/50">
          {group.targetType === 'message'
            ? 'Un message privé n’est pas lisible depuis l’administration. La décision porte sur le compte.'
            : 'Ce contenu n’existe plus — son auteur l’a supprimé.'}
        </p>
      ) : (
        <blockquote className="mb-3 whitespace-pre-wrap rounded-lg bg-sand p-3 text-sm text-forest/80">
          {group.preview}
        </blockquote>
      )}

      <dl className="mb-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-forest/50">Auteur</dt>
          <dd>
            {group.author ? (
              <Link
                href={`/admin/utilisateurs/${group.author.id}`}
                className="text-forest underline hover:no-underline"
              >
                {group.author.handle ?? group.author.email}
              </Link>
            ) : (
              <span className="text-forest/30">Inconnu</span>
            )}
            {group.author?.disabledAt && (
              <Pill tone="danger">
                <span className="ml-2">Compte désactivé</span>
              </Pill>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-forest/50">Motifs</dt>
          <dd className="flex flex-wrap gap-1.5">
            {countReasons(group.reasons).map(({ label: reason, count }) => (
              <Pill key={reason}>
                {reason}
                {count > 1 ? ` ×${count}` : ''}
              </Pill>
            ))}
          </dd>
        </div>
      </dl>

      {group.notes.length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-sm text-forest/50">Ce que disent les signaleurs</p>
          <ul className="space-y-1 text-sm text-forest/75">
            {group.notes.map((note, index) => (
              <li key={index} className="rounded-lg bg-sand px-3 py-2">
                {note}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        {canHide && group.status !== 'hidden' && (
          <ActionButton
            label="Masquer"
            tone="danger"
            action={moderateContentAction.bind(null, group.targetType, group.targetId, true)}
            confirm={{
              title: 'Masquer ce contenu ?',
              body: 'Il disparaît des fils et de la bourse. Son auteur en est informé, et ses signalements sont clos.',
              cta: 'Masquer',
            }}
          />
        )}

        {canHide && group.status === 'hidden' && (
          <ActionButton
            label="Rétablir"
            action={moderateContentAction.bind(null, group.targetType, group.targetId, false)}
            confirm={{
              title: 'Rétablir ce contenu ?',
              body: 'Il redevient visible de tous, et ses signalements sont clos.',
              cta: 'Rétablir',
            }}
          />
        )}

        <ActionButton
          label="Rejeter le signalement"
          description="Le contenu reste dans l’état où il est."
          action={dismissReportsAction.bind(null, group.targetType, group.targetId)}
        />

        {group.author && !group.author.disabledAt && (
          <Link
            href={`/admin/utilisateurs/${group.author.id}?onglet=actions`}
            className="inline-flex items-center rounded-lg border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
          >
            Désactiver le compte…
          </Link>
        )}
      </div>
    </article>
  )
}

export default async function AdminSignalementsPage() {
  await requireAdmin()

  const groups = await listOpenReports()

  return (
    <>
      <PageHeader
        title="Signalements"
        description="Les contenus signalés par la communauté, du plus signalé au moins signalé. Un contenu atteignant trois signalements distincts est masqué automatiquement, en attendant cette revue."
      />

      {groups.length === 0 ? (
        <EmptyState
          title="Rien à modérer"
          hint="Les contenus signalés par la communauté apparaîtront ici."
        />
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <ReportCard key={`${group.targetType}:${group.targetId}`} group={group} />
          ))}
        </div>
      )}
    </>
  )
}
