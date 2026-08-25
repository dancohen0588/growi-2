'use client'

import { useState } from 'react'
import { Stethoscope } from 'lucide-react'
import { ACTION_TYPE_LABELS } from '@growi/shared'
import type { GardenAction } from '@/lib/mock-actions'

import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ActionIcon } from './ActionIcon'

/**
 * Titre de la modale.
 *
 * Le titre court des tâches planifiées avant l'arrivée de `shortAction` est
 * une simple troncature du libellé — le reprendre ici afficherait une version
 * coupée du texte qui suit immédiatement. Dans ce cas seulement, on titre par
 * le geste, qui reste juste et se lit d'un trait.
 */
function dialogTitle(action: GardenAction): string {
  const isTruncated = action.shortLabel.endsWith('…')
  return isTruncated ? ACTION_TYPE_LABELS[action.type] : action.shortLabel
}

/**
 * La consigne entière d'une action, quand la carte ne peut pas la porter.
 *
 * Une recommandation de diagnostic tient rarement en une ligne : elle donne un
 * dosage, un moment de la journée, une précaution. La carte en montre le début,
 * ce lien donne le reste — tronquer sans recours ferait perdre précisément ce
 * qui rend le conseil applicable.
 */
export function ActionDetail({ action }: { action: GardenAction }) {
  const [open, setOpen] = useState(false)

  if (!action.detail) return null

  return (
    <>
      <p className="font-raleway text-xs leading-snug text-forest/60 line-clamp-2">
        {action.detail}
      </p>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="self-start font-raleway text-xs font-semibold text-forest/70 underline underline-offset-2 hover:text-forest transition-colors"
      >
        Voir le détail
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-poppins text-forest flex items-center gap-2">
              <ActionIcon type={action.type} size={18} className="shrink-0 text-forest" />
              {dialogTitle(action)}
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col gap-3">
            {action.plantName && (
              <p className="font-raleway text-sm text-forest/60">
                {action.plantEmoji} {action.plantName}
              </p>
            )}

            <p className="font-raleway text-sm leading-relaxed text-forest/85">
              {action.detail}
            </p>

            {action.source === 'task' && (
              <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-lime/25 px-2.5 py-1 font-raleway text-xs text-forest">
                <Stethoscope size={12} aria-hidden />
                Issue d&apos;un diagnostic que tu as planifié
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
