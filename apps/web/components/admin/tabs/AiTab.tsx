import { HEALTH_STATUS_LABELS, type HealthStatus } from '@growi/shared'

import { DateCell, EmptyState, Pill } from '@/components/admin/bits'
import { DataTable, type Column } from '@/components/admin/DataTable'
import {
  getUserConversations,
  getUserDiagnoses,
} from '@/lib/services/admin-user-detail.service'

type Diagnosis = Awaited<ReturnType<typeof getUserDiagnoses>>[number]
type Conversation = Awaited<ReturnType<typeof getUserConversations>>[number]

const HEALTH_TONES: Record<HealthStatus, 'positive' | 'warning' | 'danger'> = {
  HEALTHY: 'positive',
  WARNING: 'warning',
  CRITICAL: 'danger',
}

const CONFIDENCE_LABELS: Record<string, string> = {
  high: 'Élevée',
  medium: 'Moyenne',
  low: 'Faible',
}

const KIND_LABELS: Record<string, string> = {
  plant: 'Plante',
  diagnosis: 'Diagnostic',
  action: 'Action',
}

const diagnosisColumns: Column<Diagnosis>[] = [
  {
    key: 'date',
    header: 'Date',
    cell: (row) => <DateCell value={row.createdAt} withTime />,
  },
  {
    key: 'plant',
    header: 'Plante',
    cell: (row) =>
      row.plantInstance.customName ??
      row.plantInstance.catalogPlant?.commonName ?? (
        <span className="text-forest/30">Plante supprimée</span>
      ),
  },
  {
    key: 'status',
    header: 'Statut',
    cell: (row) => (
      <Pill tone={HEALTH_TONES[row.status as HealthStatus] ?? 'neutral'}>
        {HEALTH_STATUS_LABELS[row.status as HealthStatus] ?? row.status}
      </Pill>
    ),
  },
  {
    key: 'confidence',
    header: 'Confiance',
    cell: (row) => CONFIDENCE_LABELS[row.confidence] ?? row.confidence,
  },
  {
    key: 'summary',
    header: 'Résumé',
    secondary: true,
    cell: (row) => <span className="line-clamp-2 max-w-md">{row.summary}</span>,
  },
  {
    key: 'applied',
    header: 'Suites',
    cell: (row) => (
      <span className="flex flex-wrap gap-1.5">
        {row.statusApplied && <Pill tone="positive">Statut appliqué</Pill>}
        {row.tasksPlannedAt && <Pill tone="positive">Tâches planifiées</Pill>}
        {!row.statusApplied && !row.tasksPlannedAt && <span className="text-forest/30">—</span>}
      </span>
    ),
  },
  {
    key: 'model',
    header: 'Modèle',
    secondary: true,
    // Le repli d'un modèle Gemini à l'autre se fait en silence : sans cette
    // colonne, on ne peut pas relire la qualité d'un diagnostic.
    cell: (row) => <span className="text-xs text-forest/50">{row.model ?? '—'}</span>,
  },
]

const conversationColumns: Column<Conversation>[] = [
  {
    key: 'title',
    header: 'Fil',
    cell: (row) => row.title,
  },
  {
    key: 'kind',
    header: 'Ancrage',
    cell: (row) => <Pill>{KIND_LABELS[row.kind] ?? row.kind}</Pill>,
  },
  {
    key: 'messages',
    header: 'Messages',
    className: 'text-right tabular-nums',
    cell: (row) => row._count.messages,
  },
  {
    key: 'last',
    header: 'Dernier message',
    cell: (row) => <DateCell value={row.lastMessageAt ?? row.createdAt} withTime />,
  },
]

export async function AiTab({ userId }: { userId: string }) {
  const [diagnoses, conversations] = await Promise.all([
    getUserDiagnoses(userId),
    getUserConversations(userId),
  ])

  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 font-poppins text-lg font-semibold text-forest">Diagnostics</h2>
        <DataTable
          rows={diagnoses}
          columns={diagnosisColumns}
          rowKey={(row) => row.id}
          caption="Diagnostics IA du compte"
          empty={<EmptyState title="Aucun diagnostic" />}
        />
      </section>

      <section>
        <h2 className="mb-3 font-poppins text-lg font-semibold text-forest">Conversations</h2>
        <DataTable
          rows={conversations}
          columns={conversationColumns}
          rowKey={(row) => row.id}
          caption="Fils de discussion du compte"
          empty={<EmptyState title="Aucune conversation" />}
        />
      </section>
    </div>
  )
}
