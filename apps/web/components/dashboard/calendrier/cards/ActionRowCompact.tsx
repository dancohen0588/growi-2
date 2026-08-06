// growi-frontend/components/dashboard/calendrier/cards/ActionRowCompact.tsx
import {
  Droplets, Scissors, Sprout, Package,
  FlaskConical, Shield, Apple, Wrench,
} from 'lucide-react'
import { GardenAction, ActionType } from '@/lib/mock-actions'
import { formatShortDate } from '@/lib/calendar-utils'
import { DoneButton } from '../DoneButton'

const iconMap: Record<ActionType, React.ElementType> = {
  arrosage:     Droplets,
  taille:       Scissors,
  semis:        Sprout,
  rempotage:    Package,
  fertilisation:FlaskConical,
  traitement:   Shield,
  recolte:      Apple,
  autre:        Wrench,
}

interface ActionRowCompactProps {
  action: GardenAction
  onDone: (id: string) => void
}

export function ActionRowCompact({ action, onDone }: ActionRowCompactProps) {
  const Icon = iconMap[action.type]

  return (
    <div className="flex items-center gap-3 py-3 border-b border-forest/10 last:border-0">
      <Icon size={16} className="text-forest/50 shrink-0" aria-hidden />
      <div className="flex-1 min-w-0">
        <span className="font-raleway text-sm text-forest font-medium">
          {action.shortLabel}
        </span>
        {action.plantName && (
          <span className="font-raleway text-sm text-forest/60">
            {' '}· {action.plantEmoji} {action.plantName}
          </span>
        )}
      </div>
      <span className="font-raleway text-xs text-forest/40 shrink-0 capitalize">
        {formatShortDate(action.dueDate)}
      </span>
      <DoneButton
        actionId={action.id}
        actionLabel={action.label}
        variant="icon"
        onDone={onDone}
      />
    </div>
  )
}
