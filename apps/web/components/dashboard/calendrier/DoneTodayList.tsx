'use client'

import { useState } from 'react'
import type { GardenAction } from '@/lib/mock-actions'

interface DoneTodayListProps {
  actions: GardenAction[]
  onUndo: (action: GardenAction) => void
}

/** « 8:12 » — l'heure du geste, seule information utile pour le reconnaître. */
function timeOf(action: GardenAction): string {
  if (!action.doneAt) return ''
  return new Date(action.doneAt).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Ce qui a été fait aujourd'hui, avec un « Annuler » qui annule vraiment.
 *
 * L'accordéon « Actions réalisées » se souvenait de ce qu'on venait de cocher
 * et l'oubliait au premier rechargement — son état ne vivait que dans le
 * navigateur. La liste vient maintenant du journal des plantes, et « Annuler »
 * en efface le geste au lieu de faire disparaître une ligne à l'écran.
 */
export function DoneTodayList({ actions, onUndo }: DoneTodayListProps) {
  const [open, setOpen] = useState(false)
  const [undone, setUndone] = useState<Set<string>>(new Set())

  const visible = actions.filter((action) => !undone.has(action.id))
  if (visible.length === 0) return null

  return (
    <section aria-labelledby="done-today-heading" className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <p id="done-today-heading" className="font-raleway text-sm text-forest/70">
          ✅ {visible.length} geste{visible.length > 1 ? 's' : ''} fait
          {visible.length > 1 ? 's' : ''} aujourd&apos;hui
        </p>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          className="font-raleway text-sm font-semibold text-forest/70 underline underline-offset-2 hover:text-forest"
        >
          {open ? 'Masquer' : 'Voir et annuler'}
        </button>
      </div>

      {open && (
        <ul className="flex flex-col">
          {visible.map((action) => (
            <li
              key={action.id}
              className="flex items-center gap-3 border-b border-forest/10 py-2.5 opacity-75 last:border-0"
            >
              <span aria-hidden>{action.plantEmoji || '🌿'}</span>
              <span className="min-w-0 flex-1 truncate font-raleway text-sm text-forest line-through">
                {action.label}
              </span>
              <span className="shrink-0 font-raleway text-xs text-forest/45">
                {timeOf(action) && `Fait à ${timeOf(action)}`}
              </span>
              <button
                type="button"
                onClick={() => {
                  // Optimiste : la ligne part tout de suite. En cas d'échec, le
                  // parent recharge et le geste réapparaît de lui-même.
                  setUndone((prev) => new Set(prev).add(action.id))
                  onUndo(action)
                }}
                className="shrink-0 font-raleway text-xs font-semibold text-forest/70 underline underline-offset-2 hover:text-forest"
              >
                Annuler
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
