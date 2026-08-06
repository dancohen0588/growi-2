// growi-frontend/components/dashboard/calendrier/timeline/ThisWeekSection.tsx
import { GardenAction } from '@/lib/mock-actions'
import { ActionRowCompact } from '../cards/ActionRowCompact'
import { EmptyState } from '../EmptyState'

interface ThisWeekSectionProps {
  actions: GardenAction[]
  onDone: (id: string) => void
}

export function ThisWeekSection({ actions, onDone }: ThisWeekSectionProps) {
  return (
    <section aria-labelledby="week-heading">
      <div className="flex items-center gap-3 mb-3">
        <h2
          id="week-heading"
          className="font-poppins font-semibold text-forest text-base"
        >
          Cette semaine
        </h2>
        {actions.length > 0 && (
          <span className="rounded-full bg-forest/10 px-2.5 py-0.5 font-poppins text-xs font-semibold text-forest/70">
            {actions.length}
          </span>
        )}
      </div>

      {actions.length === 0 ? (
        <EmptyState message="Rien de prévu cette semaine." icon="📅" />
      ) : (
        <div className="bg-white rounded-xl shadow-card px-4">
          {actions.map(a => (
            <ActionRowCompact key={a.id} action={a} onDone={onDone} />
          ))}
        </div>
      )}
    </section>
  )
}
