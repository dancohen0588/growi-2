import { GARDEN_TYPE_LABELS, type GardenType } from '@growi/shared'

import { DateCell, EmptyState, Pill } from '@/components/admin/bits'
import { getUserGardens } from '@/lib/services/admin-user-detail.service'

export async function GardensTab({ userId }: { userId: string }) {
  const gardens = await getUserGardens(userId)

  if (gardens.length === 0) {
    return (
      <div className="rounded-2xl border border-forest/10 bg-white p-10 text-center">
        <EmptyState
          title="Aucun jardin"
          hint="Ce compte n’a pas encore cartographié de jardin."
        />
      </div>
    )
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {gardens.map((garden) => (
        <article key={garden.id} className="rounded-2xl border border-forest/10 bg-white p-5">
          <header className="mb-3 flex flex-wrap items-start justify-between gap-2">
            <h3 className="font-poppins text-base font-semibold text-forest">{garden.name}</h3>
            <Pill>
              {GARDEN_TYPE_LABELS[garden.type as GardenType] ?? garden.type}
            </Pill>
          </header>

          <dl className="grid grid-cols-2 gap-y-2 text-sm">
            <dt className="text-forest/55">Surface</dt>
            <dd className="text-right text-forest/85">
              {garden.surfaceM2 ? `${garden.surfaceM2.toLocaleString('fr-FR')} m²` : '—'}
            </dd>

            <dt className="text-forest/55">Zones</dt>
            <dd className="text-right text-forest/85">{garden._count.zones}</dd>

            <dt className="text-forest/55">Plantes</dt>
            <dd className="text-right text-forest/85">{garden._count.plantInstances}</dd>

            <dt className="text-forest/55">Orientation</dt>
            <dd className="text-right text-forest/85">{garden.orientation ?? '—'}</dd>

            <dt className="text-forest/55">Sol</dt>
            <dd className="text-right text-forest/85">{garden.soilType ?? '—'}</dd>

            <dt className="text-forest/55">Créé le</dt>
            <dd className="text-right text-forest/85">
              <DateCell value={garden.createdAt} />
            </dd>
          </dl>

          {garden.zones.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5 border-t border-forest/5 pt-3">
              {garden.zones.map((zone) => (
                <Pill key={zone.id}>{zone.name}</Pill>
              ))}
            </div>
          )}
        </article>
      ))}
    </div>
  )
}
