// growi-frontend/components/dashboard/calendrier/cards/ActionRowCompact.tsx
import Image from 'next/image'
import { GardenAction } from '@/lib/mock-actions'
import { formatDueDate } from '@/lib/calendar-utils'
import { ActionIcon } from '../ActionIcon'
import { DoneButton } from '../DoneButton'

interface ActionRowCompactProps {
  action: GardenAction
  onDone: (id: string) => void
}

/** Ligne dépouillée pour les échéances lointaines : on lit, on ne coche guère. */
export function ActionRowCompact({ action, onDone }: ActionRowCompactProps) {
  const due = formatDueDate(action.dueDate)

  return (
    <div className="flex items-center gap-3 border-b border-forest/10 py-2.5 last:border-0">
      <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg bg-sand-dark">
        {action.plantPhotoUrl ? (
          <Image src={action.plantPhotoUrl} alt="" fill sizes="36px" className="object-cover" />
        ) : (
          <span className="flex h-full items-center justify-center text-base" aria-hidden>
            {action.plantEmoji || '🌿'}
          </span>
        )}
      </div>

      <ActionIcon type={action.type} size={15} className="shrink-0 text-forest/50" />

      <div className="min-w-0 flex-1">
        <span className="font-raleway text-sm font-medium text-forest">{action.shortLabel}</span>
        {action.plantName && (
          <span className="font-raleway text-sm text-forest/60"> · {action.plantName}</span>
        )}
      </div>

      <span className="shrink-0 font-raleway text-xs capitalize text-forest/40">{due.label}</span>

      <DoneButton
        actionId={action.id}
        actionLabel={action.label}
        variant="icon"
        onDone={onDone}
      />
    </div>
  )
}
