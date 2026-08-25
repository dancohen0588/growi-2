'use client'

import { useState, useTransition } from 'react'
import { Check, Loader2, Stethoscope } from 'lucide-react'
import { ACTION_TYPE_LABELS } from '@growi/shared'

import { markActionDoneAction } from '@/app/actions/advice.actions'
import { useToast } from '@/components/ui/toast'
import { formatDueDate } from '@/lib/calendar-utils'
import type { GardenAction } from '@/lib/mock-actions'

/**
 * Ce qu'il y a à faire aujourd'hui pour cette plante, validable sur place.
 *
 * La fiche montrait déjà ces tâches, mais en lecture seule au fond de la
 * frise annuelle : il fallait passer par le calendrier pour en cocher une.
 * Elles vivent désormais en haut de page, comme sur le mobile, et se cochent
 * là où on les lit.
 */
export interface PlantTasksSectionProps {
  tasks: GardenAction[]
  /** Le planning raisonne par jardin ; sans jardin, rien à valider. */
  gardenId: string | null
  plantId: string
  onDone?: () => void
}

export function PlantTasksSection({
  tasks,
  gardenId,
  plantId,
  onDone,
}: PlantTasksSectionProps) {
  const [completed, setCompleted] = useState<Set<string>>(new Set())
  const [isPending, startTransition] = useTransition()
  const { toast } = useToast()

  const pending = tasks.filter((task) => !task.done && !completed.has(task.id))
  if (pending.length === 0 || !gardenId) return null

  const complete = (task: GardenAction) => {
    // L'affichage suit tout de suite ; l'échec remet la tâche en place.
    setCompleted((prev) => new Set(prev).add(task.id))

    startTransition(async () => {
      try {
        await markActionDoneAction(task.id, gardenId, task.type, plantId, task.taskId)
        toast('Bien noté, ton jardin te remercie 🌱')
        onDone?.()
      } catch {
        setCompleted((prev) => {
          const next = new Set(prev)
          next.delete(task.id)
          return next
        })
        toast("Le geste n'a pas pu être enregistré. Réessaie.")
      }
    })
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-poppins font-semibold text-lg text-forest">Actions à faire</h2>

      <ul className="flex flex-col gap-2">
        {pending.map((task) => (
          <li
            key={task.id}
            className="flex items-center gap-3 rounded-2xl bg-white shadow-card px-4 py-3"
          >
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center gap-2">
                <span className="font-poppins text-sm font-semibold text-forest">
                  {task.shortLabel}
                </span>
                {task.source === 'task' && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-lime/25 px-2 py-0.5 font-raleway text-[11px] font-medium text-forest"
                    title="Action issue d'un diagnostic que tu as planifié"
                  >
                    <Stethoscope size={11} aria-hidden />
                    Diagnostic
                  </span>
                )}
              </div>
              <span
                className={`font-raleway text-xs ${
                  formatDueDate(task.dueDate).late
                    ? 'font-semibold text-destructive'
                    : 'text-forest/55'
                }`}
              >
                {ACTION_TYPE_LABELS[task.type]} · {formatDueDate(task.dueDate).label}
              </span>
              {task.detail && (
                <span className="font-raleway text-xs text-forest/60 line-clamp-2">
                  {task.detail}
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={() => complete(task)}
              disabled={isPending}
              aria-label={`Marquer comme fait : ${task.shortLabel}`}
              className="shrink-0 rounded-xl bg-lime text-forest font-poppins font-semibold text-sm px-4 py-2 hover:bg-lime/80 transition-colors inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              {isPending ? (
                <Loader2 size={15} className="animate-spin" aria-hidden />
              ) : (
                <Check size={15} aria-hidden />
              )}
              C&apos;est fait
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
