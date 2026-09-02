// growi-frontend/components/dashboard/calendrier/cards/ActionCardLarge.tsx
import Image from 'next/image'
import { Clock } from 'lucide-react'
import { GardenAction } from '@/lib/mock-actions'
import { formatDueDate } from '@/lib/calendar-utils'
import { ActionIcon } from '../ActionIcon'
import { DoneButton } from '../DoneButton'
import { ActionAskLink, ActionDetail } from '../ActionDetailDialog'
import { DiagnosisBadge } from '../DiagnosisBadge'

interface ActionCardLargeProps {
  action: GardenAction
  onDone: (id: string) => void
}

/**
 * Carte d'un geste à faire aujourd'hui : la photo de la plante en tête, le
 * geste en titre. Même hiérarchie que la carte de l'app mobile — photo, verbe,
 * validation — pour qu'on reconnaisse l'écran d'un support à l'autre.
 */
export function ActionCardLarge({ action, onDone }: ActionCardLargeProps) {
  const due = formatDueDate(action.dueDate)

  return (
    <div className="overflow-hidden rounded-2xl bg-white shadow-card transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5">
      <div className="relative h-40 bg-sand-dark">
        {action.plantPhotoUrl ? (
          <Image
            src={action.plantPhotoUrl}
            alt={action.plantName ?? 'Plante'}
            fill
            sizes="(max-width: 768px) 100vw, 320px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-sand text-5xl" aria-hidden>
            {action.plantEmoji || '🌿'}
          </div>
        )}

        {/* Voile : le nom doit rester lisible sur une photo claire. */}
        <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-forest/80 to-transparent" />
        <p className="absolute inset-x-4 bottom-3 truncate font-poppins font-semibold text-lg text-sand">
          {action.plantName ?? 'Ma plante'}
        </p>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div>
          <div className="flex items-center gap-2">
            <ActionIcon type={action.type} size={17} className="shrink-0 text-forest" />
            <h3 className="font-poppins font-semibold text-forest leading-snug">
              {action.shortLabel}
            </h3>
            <DiagnosisBadge action={action} />
          </div>

          <div
            className={`mt-1 flex items-center gap-1.5 font-raleway text-xs ${
              due.late ? 'font-semibold text-destructive' : 'text-forest/50'
            }`}
          >
            {due.late && <Clock size={12} aria-hidden />}
            <span>
              {due.label}
              {action.estimatedMinutes ? ` · ~${action.estimatedMinutes} min` : ''}
            </span>
          </div>

          <div className="mt-2 flex flex-col gap-1">
            <ActionDetail action={action} />
            <ActionAskLink action={action} />
          </div>

          {action.notes && (
            <p className="mt-2 font-raleway text-sm italic leading-relaxed text-forest/60">
              {action.notes}
            </p>
          )}
        </div>

        <DoneButton
          actionId={action.id}
          actionLabel={action.label}
          variant="full"
          onDone={onDone}
        />
      </div>
    </div>
  )
}
