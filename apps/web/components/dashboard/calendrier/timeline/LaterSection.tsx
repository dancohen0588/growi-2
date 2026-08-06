// growi-frontend/components/dashboard/calendrier/timeline/LaterSection.tsx
import { GardenAction } from '@/lib/mock-actions'
import { groupByMonth } from '@/lib/calendar-utils'

interface LaterSectionProps {
  actions: GardenAction[]
}

export function LaterSection({ actions }: LaterSectionProps) {
  if (actions.length === 0) return null

  const months = groupByMonth(actions)

  return (
    <section aria-labelledby="later-heading">
      <h2
        id="later-heading"
        className="font-poppins font-semibold text-forest text-base mb-3"
      >
        Plus tard
      </h2>
      <div className="flex flex-col gap-2">
        {months.map(({ monthLabel, actions: monthActions }) => {
          const labels = monthActions.map(a => a.shortLabel.toLowerCase())
          const unique = Array.from(new Set(labels))
          const summary = unique.join(', ')
          return (
            <div
              key={monthLabel}
              className="border-l-2 border-dashed border-forest/20 pl-4 py-1"
            >
              <p className="font-raleway text-sm italic text-forest/50">
                <span className="font-semibold not-italic text-forest/70 capitalize">
                  {monthLabel}
                </span>{' '}
                — {summary}
              </p>
            </div>
          )
        })}
      </div>
    </section>
  )
}
