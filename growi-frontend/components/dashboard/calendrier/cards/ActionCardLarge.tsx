// growi-frontend/components/dashboard/calendrier/cards/ActionCardLarge.tsx
import { Clock } from 'lucide-react'
import { GardenAction } from '@/lib/mock-actions'
import { priorityBorderColor, priorityBadgeColor, priorityLabel } from '@/lib/calendar-utils'
import { DoneButton } from '../DoneButton'
import { cn } from '@/lib/utils'

interface ActionCardLargeProps {
  action: GardenAction
  onDone: (id: string) => void
}

export function ActionCardLarge({ action, onDone }: ActionCardLargeProps) {
  return (
    <div
      className={cn(
        'rounded-2xl shadow-card bg-white p-5 border-l-4 transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5',
        priorityBorderColor[action.priority],
      )}
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          {action.plantEmoji && (
            <span className="text-2xl shrink-0" aria-hidden>{action.plantEmoji}</span>
          )}
          <h3 className="font-poppins font-semibold text-forest text-base leading-snug">
            {action.label}
          </h3>
        </div>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-0.5 font-raleway text-xs font-semibold',
            priorityBadgeColor[action.priority],
          )}
        >
          {priorityLabel[action.priority]}
        </span>
      </div>

      {/* Notes */}
      {action.notes && (
        <p className="font-raleway text-sm italic text-forest/60 mb-3 leading-relaxed">
          {action.notes}
        </p>
      )}

      {/* Meta row */}
      {action.estimatedMinutes && (
        <div className="flex items-center gap-1.5 text-forest/50 font-raleway text-xs mb-4">
          <Clock size={12} aria-hidden />
          <span>~{action.estimatedMinutes} min</span>
        </div>
      )}

      {/* CTA */}
      <DoneButton
        actionId={action.id}
        actionLabel={action.label}
        variant="full"
        onDone={onDone}
      />
    </div>
  )
}
