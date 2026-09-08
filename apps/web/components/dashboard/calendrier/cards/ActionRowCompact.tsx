'use client'

import Image from 'next/image'
import { GardenAction } from '@/lib/mock-actions'
import { formatActionWhen } from '@/lib/calendar-utils'
import { ActionIcon } from '../ActionIcon'
import { DiagnosisBadge } from '../DiagnosisBadge'
import { DoneButton } from '../DoneButton'

interface ActionRowCompactProps {
  action: GardenAction
  onDone: (id: string) => void
  onOpenDetail: (action: GardenAction) => void
}

/**
 * Ligne dépouillée pour ce qui vient plus tard, ou se fait à son rythme.
 *
 * Jamais de rouge ici : une action à fenêtre n'est pas en retard tant que sa
 * période est ouverte, et c'est `formatActionWhen` qui le garantit — elle
 * annonce « avant fin octobre » là où l'échéance seule aurait crié.
 */
export function ActionRowCompact({ action, onDone, onOpenDetail }: ActionRowCompactProps) {
  const when = formatActionWhen(action)

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

      <DiagnosisBadge action={action} />

      <span className="shrink-0 font-raleway text-xs first-letter:capitalize text-forest/40">
        {when.label}
      </span>

      <button
        type="button"
        onClick={() => onOpenDetail(action)}
        className="shrink-0 rounded-lg border border-forest/15 px-2.5 py-1 font-raleway text-xs font-semibold text-forest/70 transition-colors hover:bg-sand hover:text-forest"
      >
        Détails
      </button>

      <DoneButton
        actionId={action.id}
        actionLabel={action.label}
        variant="icon"
        onDone={onDone}
      />
    </div>
  )
}
