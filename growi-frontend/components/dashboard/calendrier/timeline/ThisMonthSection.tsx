// growi-frontend/components/dashboard/calendrier/timeline/ThisMonthSection.tsx
import { GardenAction } from '@/lib/mock-actions'
import { ActionGroupAccordion } from '../cards/ActionGroupAccordion'
import { EmptyState } from '../EmptyState'
import { formatMediumDate } from '@/lib/calendar-utils'

interface ThisMonthSectionProps {
  actions: GardenAction[]
  onDone: (id: string) => void
}

function getWeekLabel(actions: GardenAction[]): string {
  if (actions.length === 0) return ''
  const sorted = [...actions].sort((a, b) => a.dueDate.localeCompare(b.dueDate))
  const first = sorted[0]
  return `semaine du ${formatMediumDate(first.dueDate)}`
}

function chunkByWeek(
  actions: GardenAction[],
): { weekLabel: string; actions: GardenAction[]; id: string }[] {
  // Group by ISO week number
  const map = new Map<number, GardenAction[]>()
  for (const a of actions) {
    const d = new Date(a.dueDate)
    const startOfYear = new Date(d.getFullYear(), 0, 1)
    const weekNo = Math.ceil(
      ((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7,
    )
    if (!map.has(weekNo)) map.set(weekNo, [])
    map.get(weekNo)!.push(a)
  }
  return Array.from(map.entries()).map(([weekNo, items]) => ({
    weekLabel: getWeekLabel(items),
    actions: items,
    id: `week-${weekNo}`,
  }))
}

export function ThisMonthSection({ actions, onDone }: ThisMonthSectionProps) {
  const weeks = chunkByWeek(actions)

  return (
    <section aria-labelledby="month-heading">
      <div className="flex items-center gap-3 mb-3">
        <h2
          id="month-heading"
          className="font-poppins font-semibold text-forest text-base"
        >
          Ce mois-ci
        </h2>
        {actions.length > 0 && (
          <span className="rounded-full bg-forest/10 px-2.5 py-0.5 font-poppins text-xs font-semibold text-forest/70">
            {actions.length}
          </span>
        )}
      </div>

      {weeks.length === 0 ? (
        <EmptyState message="Rien de prévu ce mois-ci." icon="🗓️" />
      ) : (
        <div className="bg-white rounded-xl shadow-card px-4 divide-y divide-forest/10">
          {weeks.map(w => (
            <ActionGroupAccordion
              key={w.id}
              groupId={w.id}
              weekLabel={w.weekLabel}
              actions={w.actions}
              onDone={onDone}
            />
          ))}
        </div>
      )}
    </section>
  )
}
