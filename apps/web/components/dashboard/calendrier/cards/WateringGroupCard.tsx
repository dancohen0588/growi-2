'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Droplets } from 'lucide-react'
import type { ActionGroup } from '@growi/shared'
import type { GardenAction } from '@/lib/mock-actions'

import { Button } from '@/components/ui/button'
import { formatActionWhen } from '@/lib/calendar-utils'

/** Au-delà, les vignettes ne se distinguent plus les unes des autres. */
const MAX_AVATARS = 5

interface WateringGroupCardProps {
  group: ActionGroup
  /** Coche les actions retenues en un seul appel. */
  onDoneMany: (actions: GardenAction[]) => void
  onOpenDetail: (action: GardenAction) => void
}

function Avatar({ action }: { action: GardenAction }) {
  return (
    <span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-white bg-sand-dark">
      {action.plantPhotoUrl ? (
        <Image src={action.plantPhotoUrl} alt="" fill sizes="40px" className="object-cover" />
      ) : (
        <span className="text-lg" aria-hidden>
          {action.plantEmoji || '🌿'}
        </span>
      )}
    </span>
  )
}

/**
 * Un geste, une carte : arroser cinq plantes n'est pas cinq décisions.
 *
 * Cinq cartes à valider une à une chaque matin, c'est ce qui donnait envie de
 * tout ignorer. « Tout arrosé » coche l'ensemble en un appel ; « Choisir »
 * déplie la liste, toutes cochées, pour décocher l'exception plutôt que de
 * cocher la règle.
 */
export function WateringGroupCard({ group, onDoneMany, onOpenDetail }: WateringGroupCardProps) {
  const [picking, setPicking] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(group.actions.map((a) => a.id)),
  )

  const late = group.actions.filter((a) => formatActionWhen(a).late)
  const shown = group.actions.slice(0, MAX_AVATARS)
  const names = group.actions
    .map((a) => a.plantName)
    .filter(Boolean)
    .slice(0, 3)
    .join(', ')

  const chosen = group.actions.filter((a) => selected.has(a.id))

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-card">
      <div className="flex items-center gap-2">
        <Droplets size={18} className="shrink-0 text-forest" aria-hidden />
        <h3 className="font-poppins font-semibold text-forest">
          Arrosage · {group.actions.length} plantes
        </h3>
      </div>

      <div className="flex items-center -space-x-2">
        {shown.map((action) => (
          <button
            key={action.id}
            type="button"
            onClick={() => onOpenDetail(action)}
            aria-label={`Détails : ${action.plantName ?? 'plante'}`}
            className="rounded-full transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime"
          >
            <Avatar action={action} />
          </button>
        ))}
        {group.actions.length > MAX_AVATARS && (
          <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-sand font-raleway text-xs font-semibold text-forest">
            +{group.actions.length - MAX_AVATARS}
          </span>
        )}
      </div>

      <p className="truncate font-raleway text-xs text-forest/55">
        {names}
        {late.length > 0 && (
          <span className="font-semibold text-destructive">
            {' '}
            · {late.length} en retard
          </span>
        )}
      </p>

      {picking && (
        <ul className="flex flex-col gap-1 rounded-xl bg-sand/60 p-2">
          {group.actions.map((action) => (
            <li key={action.id}>
              <label className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1.5 font-raleway text-sm text-forest hover:bg-white/70">
                <input
                  type="checkbox"
                  checked={selected.has(action.id)}
                  onChange={() => toggle(action.id)}
                  className="h-4 w-4 accent-lime"
                />
                <span aria-hidden>{action.plantEmoji || '🌿'}</span>
                <span className="min-w-0 flex-1 truncate">{action.plantName ?? 'Plante'}</span>
                <span
                  className={`shrink-0 font-raleway text-xs ${
                    formatActionWhen(action).late
                      ? 'font-semibold text-destructive'
                      : 'text-forest/45'
                  }`}
                >
                  {formatActionWhen(action).label}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center gap-2">
        {picking ? (
          <>
            <Button
              variant="primary"
              className="flex-1"
              disabled={chosen.length === 0}
              onClick={() => onDoneMany(chosen)}
            >
              Valider ({chosen.length})
            </Button>
            <Button variant="outline" onClick={() => setPicking(false)}>
              Annuler
            </Button>
          </>
        ) : (
          <>
            <Button variant="primary" className="flex-1" onClick={() => onDoneMany(group.actions)}>
              ✓ Tout arrosé
            </Button>
            <Button variant="outline" onClick={() => setPicking(true)}>
              Choisir
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
