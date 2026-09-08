'use client'

import Image from 'next/image'
import { Clock, Stethoscope } from 'lucide-react'
import { GardenAction } from '@/lib/mock-actions'
import { formatActionWhen } from '@/lib/calendar-utils'
import { Button } from '@/components/ui/button'
import { ActionIcon } from '../ActionIcon'
import { DoneButton } from '../DoneButton'

interface ActionCardLargeProps {
  action: GardenAction
  onDone: (id: string) => void
  onOpenDetail: (action: GardenAction) => void
}

/**
 * Carte d'un geste à faire aujourd'hui : photo, verbe, une ligne, deux boutons.
 *
 * Rien de plus. La carte empilait la consigne, les notes, la durée estimée,
 * « Voir le détail » et « Comment faire ? » — un pavé que personne ne lisait
 * avant d'agir, alors que la décision se prend sur la photo et le verbe. Tout
 * le texte a migré dans la popin, qu'ouvre le bouton *Détails* ou n'importe
 * quel point de la carte.
 */
export function ActionCardLarge({ action, onDone, onOpenDetail }: ActionCardLargeProps) {
  const when = formatActionWhen(action)
  // Le « pourquoi » de la règle tient lieu de contexte ; sinon, l'échéance.
  const context = action.why ?? action.detail

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Détails : ${action.label}`}
      onClick={() => onOpenDetail(action)}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return
        event.preventDefault()
        onOpenDetail(action)
      }}
      className="cursor-pointer overflow-hidden rounded-2xl bg-white text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
    >
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
            <h3 className="min-w-0 flex-1 truncate font-poppins font-semibold text-forest leading-snug">
              {action.shortLabel}
            </h3>
            {/* Pastille seule : le mot « Diagnostic » disait deux fois ce que
                l'icône dit déjà, sur une carte où chaque ligne compte. */}
            {action.source === 'task' && (
              <span
                className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-lime/25 text-forest"
                title="Action issue d'un diagnostic que tu as planifié"
              >
                <Stethoscope size={13} aria-hidden />
                <span className="sr-only">Issue d&apos;un diagnostic</span>
              </span>
            )}
          </div>

          <p
            className={`mt-1 flex items-center gap-1.5 truncate font-raleway text-xs ${
              when.late ? 'font-semibold text-destructive' : 'text-forest/55'
            }`}
          >
            {when.late && <Clock size={12} aria-hidden />}
            <span className="truncate">{context ?? when.label}</span>
          </p>
        </div>

        {/* Les boutons ne doivent pas ouvrir la popin en même temps qu'agir. */}
        <div
          className="flex items-center gap-2"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
          role="presentation"
        >
          <DoneButton
            actionId={action.id}
            actionLabel={action.label}
            variant="full"
            onDone={onDone}
          />
          <Button
            variant="outline"
            className="shrink-0"
            onClick={() => onOpenDetail(action)}
          >
            Détails
          </Button>
        </div>
      </div>
    </div>
  )
}
