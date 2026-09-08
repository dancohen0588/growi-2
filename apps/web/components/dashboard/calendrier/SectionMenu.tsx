'use client'

import { useEffect, useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { ACTION_TYPE_LABELS, type ActionType } from '@growi/shared'
import type { GardenAction } from '@/lib/mock-actions'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface SectionMenuProps {
  /** Les actions de la section, celles que « Tout marquer fait » va inscrire. */
  actions: GardenAction[]
  onDoneAll: () => void
  /** Absent sur « Ce mois-ci » : on n'ignore que la journée. */
  onClearToday?: () => void
}

/** « 5 arrosages et 1 traitement » — dire ce qui sera écrit au journal. */
function describe(actions: GardenAction[]): string {
  const counts = new Map<ActionType, number>()
  for (const action of actions) counts.set(action.type, (counts.get(action.type) ?? 0) + 1)

  const parts = [...counts.entries()].map(
    ([type, count]) => `${count} ${ACTION_TYPE_LABELS[type].toLowerCase()}${count > 1 ? 's' : ''}`,
  )

  if (parts.length === 1) return parts[0]
  return `${parts.slice(0, -1).join(', ')} et ${parts[parts.length - 1]}`
}

/**
 * Le menu d'une section : tout marquer fait, ou ignorer pour aujourd'hui.
 *
 * Deux gestes distincts et non un seul « vider » : l'un écrit les gestes au
 * journal des plantes, l'autre n'écrit rien. Les confondre reviendrait à faire
 * mentir le journal — c'est lui qui sert ensuite à dire quand la plante a été
 * arrosée pour la dernière fois.
 */
export function SectionMenu({ actions, onDoneAll, onClearToday }: SectionMenuProps) {
  const [open, setOpen] = useState(false)
  const [confirm, setConfirm] = useState<'done' | 'clear' | null>(null)
  const container = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (actions.length === 0) return null

  const engineActions = actions.filter((action) => action.source !== 'task')
  const taskActions = actions.length - engineActions.length

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        aria-label="Actions groupées de la section"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="grid h-8 w-8 place-items-center rounded-full text-forest/60 transition-colors hover:bg-sand-dark hover:text-forest"
      >
        <MoreHorizontal size={18} aria-hidden />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-9 z-20 w-64 overflow-hidden rounded-xl border border-forest/10 bg-white py-1 shadow-card-hover"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              setConfirm('done')
            }}
            className="flex w-full items-center gap-2 px-3 py-2.5 text-left font-raleway text-sm text-forest hover:bg-sand"
          >
            ✅ Tout marquer comme fait
          </button>

          {onClearToday && (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                setConfirm('clear')
              }}
              className="flex w-full items-center gap-2 px-3 py-2.5 text-left font-raleway text-sm text-forest hover:bg-sand"
            >
              🙈 Ignorer pour aujourd&apos;hui
            </button>
          )}
        </div>
      )}

      <AlertDialog open={confirm === 'done'} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tout marquer comme fait ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les <strong>{actions.length} actions</strong> seront notées faites et inscrites au
              journal de tes plantes : {describe(actions)}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <p className="font-raleway text-sm text-forest/55">
            Tu pourras annuler chaque geste depuis « Fait aujourd&apos;hui ».
          </p>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirm(null)
                onDoneAll()
              }}
            >
              Confirmer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={confirm === 'clear'} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ignorer pour aujourd&apos;hui ?</AlertDialogTitle>
            <AlertDialogDescription>
              Les <strong>{engineActions.length} actions</strong> proposées par Growi seront
              masquées jusqu&apos;à demain. <strong>Rien ne sera inscrit</strong> au journal de tes
              plantes.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {taskActions > 0 && (
            <p className="font-raleway text-sm text-forest/55">
              {taskActions === 1
                ? 'L’action issue de ton diagnostic reste affichée.'
                : `Les ${taskActions} actions issues de tes diagnostics restent affichées.`}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirm(null)
                onClearToday?.()
              }}
            >
              Ignorer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
