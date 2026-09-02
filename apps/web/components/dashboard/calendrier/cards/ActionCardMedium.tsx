// growi-frontend/components/dashboard/calendrier/cards/ActionCardMedium.tsx
import Image from 'next/image'
import { GardenAction } from '@/lib/mock-actions'
import { formatDueDate } from '@/lib/calendar-utils'
import { ActionIcon } from '../ActionIcon'
import { DoneButton } from '../DoneButton'
import { ActionAskLink, ActionDetail } from '../ActionDetailDialog'
import { DiagnosisBadge } from '../DiagnosisBadge'

interface ActionCardMediumProps {
  action: GardenAction
  onDone: (id: string) => void
}

/**
 * Ligne d'un geste à venir : vignette de la plante, icône du geste posée
 * dessus, validation à droite. Reprend la ligne de l'app mobile.
 */
export function ActionCardMedium({ action, onDone }: ActionCardMediumProps) {
  const due = formatDueDate(action.dueDate)

  const meta = [action.plantName, due.label, action.estimatedMinutes ? `~${action.estimatedMinutes} min` : null]
    .filter(Boolean)
    .join(' · ')

  return (
    <div className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-card">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-sand-dark">
        {action.plantPhotoUrl ? (
          <Image
            src={action.plantPhotoUrl}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <span className="flex h-full items-center justify-center text-2xl" aria-hidden>
            {action.plantEmoji || '🌿'}
          </span>
        )}
        <span className="absolute -bottom-0.5 -right-0.5 grid h-6 w-6 place-items-center rounded-full border-2 border-white bg-sand text-forest">
          <ActionIcon type={action.type} size={13} />
        </span>
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-poppins font-semibold text-forest text-sm">
          {action.shortLabel}
        </p>
        <div className="flex items-center gap-2">
          <p
            className={`truncate font-raleway text-xs ${
              due.late ? 'font-semibold text-destructive' : 'text-forest/60'
            }`}
          >
            {meta}
          </p>
          <DiagnosisBadge action={action} />
        </div>

        <div className="mt-1 flex flex-col gap-0.5">
          <ActionDetail action={action} />
          <ActionAskLink action={action} />
        </div>
      </div>

      <DoneButton
        actionId={action.id}
        actionLabel={action.label}
        variant="outline"
        onDone={onDone}
        className="w-auto shrink-0"
      />
    </div>
  )
}
