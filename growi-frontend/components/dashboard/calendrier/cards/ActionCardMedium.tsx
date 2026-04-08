// growi-frontend/components/dashboard/calendrier/cards/ActionCardMedium.tsx
import { Clock, Droplets, Scissors, Sprout, Package, FlaskConical, Shield, Apple, Wrench } from 'lucide-react'
import { GardenAction, ActionType } from '@/lib/mock-actions'
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

const typeLabel: Record<ActionType, string> = {
  arrosage:     'Arrosage',
  taille:       'Taille',
  semis:        'Semis',
  rempotage:    'Rempotage',
  fertilisation:'Fertilisation',
  traitement:   'Traitement',
  recolte:      'Récolte',
  autre:        'Autre',
}

interface ActionCardMediumProps {
  action: GardenAction
  onDone: (id: string) => void
}

export function ActionCardMedium({ action, onDone }: ActionCardMediumProps) {
  const Icon = iconMap[action.type]

  return (
    <div className="rounded-xl shadow-card bg-white p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Icon size={20} className="text-forest/60 shrink-0" aria-hidden />
        <p className="font-poppins font-semibold text-forest text-sm flex-1 leading-snug">
          {action.label}
        </p>
        <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 font-raleway text-xs text-forest/70 border border-forest/10">
          {typeLabel[action.type]}
        </span>
      </div>

      {action.estimatedMinutes && (
        <div className="flex items-center gap-1.5 text-forest/50 font-raleway text-xs mb-3">
          <Clock size={12} aria-hidden />
          <span>~{action.estimatedMinutes} min</span>
        </div>
      )}

      <DoneButton
        actionId={action.id}
        actionLabel={action.label}
        variant="outline"
        onDone={onDone}
      />
    </div>
  )
}
