import {
  HEALTH_STATUS_LABELS,
  PLANT_LOCATION_LABELS,
  type HealthStatus,
  type PlantLocation,
} from '@growi/shared'

import { DateCell, EmptyState, Pill } from '@/components/admin/bits'
import { DataTable, type Column } from '@/components/admin/DataTable'
import { getUserPlants } from '@/lib/services/admin-user-detail.service'

type Plant = Awaited<ReturnType<typeof getUserPlants>>[number]

const HEALTH_TONES: Record<HealthStatus, 'positive' | 'warning' | 'danger'> = {
  HEALTHY: 'positive',
  WARNING: 'warning',
  CRITICAL: 'danger',
}

const columns: Column<Plant>[] = [
  {
    key: 'name',
    header: 'Plante',
    cell: (plant) => (
      <span className="block">
        <span className="block">
          {plant.emoji ? `${plant.emoji} ` : ''}
          {plant.displayName}
        </span>
        {plant.catalogPlant && (
          <span className="block text-xs font-normal italic text-forest/50">
            {plant.catalogPlant.scientificName}
          </span>
        )}
      </span>
    ),
  },
  {
    key: 'garden',
    header: 'Jardin',
    cell: (plant) => (
      <span>
        {plant.garden?.name ?? <span className="text-forest/30">Sans jardin</span>}
        {plant.zone && <span className="block text-xs text-forest/50">{plant.zone.name}</span>}
      </span>
    ),
  },
  {
    key: 'location',
    header: 'Emplacement',
    secondary: true,
    cell: (plant) => PLANT_LOCATION_LABELS[plant.location as PlantLocation] ?? plant.location,
  },
  {
    key: 'health',
    header: 'Santé',
    cell: (plant) => (
      <Pill tone={HEALTH_TONES[plant.healthStatus as HealthStatus] ?? 'neutral'}>
        {HEALTH_STATUS_LABELS[plant.healthStatus as HealthStatus] ?? plant.healthStatus}
      </Pill>
    ),
  },
  {
    key: 'watered',
    header: 'Dernier arrosage',
    cell: (plant) => <DateCell value={plant.lastWateredAt} />,
  },
  {
    key: 'fertilized',
    header: 'Dernière fertilisation',
    secondary: true,
    cell: (plant) => <DateCell value={plant.lastFertilizedAt} />,
  },
  {
    key: 'tasks',
    header: 'Tâches',
    className: 'text-right tabular-nums',
    cell: (plant) =>
      plant.openTasks > 0 ? (
        <Pill tone="warning">{plant.openTasks}</Pill>
      ) : (
        <span className="text-forest/30">0</span>
      ),
  },
  {
    key: 'alerts',
    header: 'Alertes',
    secondary: true,
    cell: (plant) =>
      plant.alertsEnabled ? (
        <span className="text-forest/60">Oui</span>
      ) : (
        // Une plante dont les alertes sont coupées n'apparaît dans aucun
        // rappel : c'est une explication fréquente d'un « je ne reçois rien ».
        <Pill tone="danger">Coupées</Pill>
      ),
  },
]

export async function PlantsTab({ userId }: { userId: string }) {
  const plants = await getUserPlants(userId)

  return (
    <DataTable
      rows={plants}
      columns={columns}
      rowKey={(plant) => plant.id}
      caption="Plantes du compte"
      empty={
        <EmptyState title="Aucune plante" hint="Ce compte n’a encore ajouté aucune plante." />
      }
    />
  )
}
