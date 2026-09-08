'use client'

import { useState, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { useReducedMotion } from 'framer-motion'
import type { GardenAction } from '@/lib/mock-actions'
import type { PlantAlert } from '@/lib/recommendation/types'
import { groupActionsByHorizon } from '@growi/shared'
import { CalendarViewToggle, type ActiveView } from '@/components/dashboard/calendrier/CalendarViewToggle'
import { TodoView } from '@/components/dashboard/calendrier/views/TodoView'
import { CalendarView } from '@/components/dashboard/calendrier/views/CalendarView'
import { WeatherAlertBanner } from '@/components/dashboard/calendrier/WeatherAlertBanner'
import {
  clearPlanningTodayAction,
  markActionDoneAction,
  markActionsDoneAction,
  undoActionAction,
} from '@/app/actions/advice.actions'
import { useToast } from '@/components/ui/toast'
import { fadeIn } from '@/lib/animations'

interface CalendrierPageInnerProps {
  initialActions: GardenAction[]
  /** Les gestes déjà notés aujourd'hui, avec de quoi les annuler. */
  initialDoneToday: GardenAction[]
  alerts: PlantAlert[]
  /** Jardin d'origine de chaque action : le calendrier les réunit tous. */
  actionGardenIds: Record<string, string>
  /** Jardin à acquitter pour une action dont l'origine s'est perdue. */
  fallbackGardenId: string
  /** Tous les jardins de l'utilisateur — « ignorer » s'applique à chacun. */
  gardenIds: string[]
  /** Au moins un jardin est en pause pour aujourd'hui. */
  clearedToday: boolean
}

function CalendrierContent({
  initialActions,
  initialDoneToday,
  alerts,
  actionGardenIds,
  fallbackGardenId,
  gardenIds,
  clearedToday,
}: CalendrierPageInnerProps) {
  const searchParams = useSearchParams()
  const router = useRouter()
  const activeView = (searchParams.get('vue') as ActiveView) ?? 'todo'
  const { toast } = useToast()
  const prefersReduced = useReducedMotion()

  const [actions, setActions] = useState<GardenAction[]>(initialActions)
  const [doneToday, setDoneToday] = useState<GardenAction[]>(initialDoneToday)
  const [cleared, setCleared] = useState(clearedToday)

  const gardenOf = useCallback(
    (action: GardenAction) => actionGardenIds[action.id] ?? fallbackGardenId,
    [actionGardenIds, fallbackGardenId],
  )

  /** Retire les actions cochées et les fait passer dans « Fait aujourd'hui ». */
  const settle = useCallback((done: GardenAction[], careLogIds: (string | null)[]) => {
    const ids = new Set(done.map((a) => a.id))
    setActions((prev) => prev.filter((a) => !ids.has(a.id)))
    setDoneToday((prev) => [
      ...done.map((action, index) => ({
        ...action,
        done: true,
        doneAt: new Date().toISOString(),
        careLogId: careLogIds[index] ?? undefined,
      })),
      ...prev,
    ])
  }, [])

  const handleDone = useCallback(
    (id: string) => {
      const action = actions.find((a) => a.id === id)
      if (!action) return

      // L'affichage suit tout de suite ; l'échec recharge la page serveur, qui
      // fait autorité — plutôt que de rejouer à la main un état qu'on a deviné.
      setActions((prev) => prev.filter((a) => a.id !== id))

      // `taskId` n'est renseigné que pour une tâche planifiée : il l'acquitte
      // nommément, là où le moteur se contente du geste au journal.
      markActionDoneAction(id, gardenOf(action), action.type, action.plantId, action.taskId)
        .then(({ careLogId }) => {
          settle([action], [careLogId])
          toast('✓ Action notée comme faite ! Ton jardin te remercie 🌱')
        })
        .catch(() => {
          setActions((prev) => [action, ...prev])
          toast('Erreur lors de la sauvegarde. Réessaie.')
        })
    },
    [actions, gardenOf, settle, toast],
  )

  /**
   * « Tout arrosé », « Tout marquer comme fait » — un appel, pas N.
   *
   * Les actions sont groupées par jardin : le calendrier les réunit tous, et
   * l'endpoint groupé n'en accepte qu'un par appel.
   */
  const handleDoneMany = useCallback(
    (chosen: GardenAction[]) => {
      if (chosen.length === 0) return

      const ids = new Set(chosen.map((a) => a.id))
      setActions((prev) => prev.filter((a) => !ids.has(a.id)))

      const byGarden = new Map<string, GardenAction[]>()
      for (const action of chosen) {
        const gardenId = gardenOf(action)
        byGarden.set(gardenId, [...(byGarden.get(gardenId) ?? []), action])
      }

      Promise.all(
        [...byGarden.entries()].map(([gardenId, group]) =>
          markActionsDoneAction({
            gardenId,
            items: group.map((action) => ({
              actionType: action.type,
              plantId: action.plantId,
              taskId: action.taskId,
            })),
          }).then((result) => ({ group, result })),
        ),
      )
        .then((results) => {
          let skipped = 0
          for (const { group, result } of results) {
            settle(group, result.careLogIds)
            skipped += result.skipped
          }

          const done = chosen.length - skipped
          toast(
            skipped > 0
              ? `${done} geste${done > 1 ? 's' : ''} noté${done > 1 ? 's' : ''}, ${skipped} ignoré${skipped > 1 ? 's' : ''}.`
              : `✓ ${done} geste${done > 1 ? 's' : ''} noté${done > 1 ? 's' : ''} · à retrouver dans « Fait aujourd'hui »`,
          )
        })
        .catch(() => {
          setActions((prev) => [...chosen, ...prev])
          toast('Erreur lors de la sauvegarde. Réessaie.')
        })
    },
    [gardenOf, settle, toast],
  )

  /** Annuler pour de bon : le geste quitte le journal et l'action revient. */
  const handleUndo = useCallback(
    (action: GardenAction) => {
      if (!action.careLogId) return

      setDoneToday((prev) => prev.filter((a) => a.id !== action.id))

      undoActionAction({
        gardenId: gardenOf(action),
        careLogId: action.careLogId,
        taskId: action.taskId,
      })
        .then(() => {
          toast('Geste annulé.')
          // Le moteur décide de ce qui revient, et à quelle date : on le lui
          // redemande plutôt que de réinventer l'action ici.
          router.refresh()
        })
        .catch(() => {
          setDoneToday((prev) => [action, ...prev])
          toast("L'annulation a échoué. Réessaie.")
        })
    },
    [gardenOf, router, toast],
  )

  /** « Ignorer pour aujourd'hui », et son « Rétablir ». */
  const handleClear = useCallback(
    (undo: boolean) => {
      setCleared(!undo)

      Promise.all(gardenIds.map((gardenId) => clearPlanningTodayAction({ gardenId, undo })))
        .then(() => {
          toast(
            undo
              ? 'Actions rétablies.'
              : "Actions du jour ignorées. Rien n'a été inscrit au journal.",
          )
          router.refresh()
        })
        .catch(() => {
          setCleared(undo)
          toast('Impossible de mettre le planning en pause. Réessaie.')
        })
    },
    [gardenIds, router, toast],
  )

  const pendingByHorizon = useMemo(
    () => groupActionsByHorizon(actions.filter((a) => !a.done)),
    [actions],
  )

  return (
    <div className="flex flex-col gap-6 max-w-2xl lg:max-w-none">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-poppins font-bold text-[1.75rem] text-forest">
            Ton calendrier jardin 📅
          </h1>
          <p className="font-raleway text-forest/60 mt-1">
            Ce qui presse d&apos;abord&nbsp;; le reste, quand tu peux.
          </p>
        </div>
        <Suspense>
          <CalendarViewToggle activeView={activeView} />
        </Suspense>
      </div>

      {/* Weather alerts */}
      {alerts.length > 0 && <WeatherAlertBanner alerts={alerts} />}

      {/* Summary bar */}
      <div className="rounded-xl bg-sand px-4 py-3 flex flex-wrap gap-x-5 gap-y-1 font-raleway text-sm text-forest/70">
        {doneToday.length > 0 && (
          <span>
            ✅ {doneToday.length} fait{doneToday.length > 1 ? 's' : ''} aujourd&apos;hui
          </span>
        )}
        <span>🌱 {pendingByHorizon.today.length} aujourd&apos;hui</span>
        <span>📆 {pendingByHorizon.week.length} cette semaine</span>
        <span>🌿 {pendingByHorizon.month.length} ce mois-ci</span>
      </div>

      {/* Views */}
      <AnimatePresence mode="wait">
        {activeView === 'todo' ? (
          <motion.div
            key="todo"
            variants={prefersReduced ? undefined : fadeIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <TodoView
              actions={actions}
              doneToday={doneToday}
              cleared={cleared}
              onDone={handleDone}
              onDoneMany={handleDoneMany}
              onUndo={handleUndo}
              onClearToday={() => handleClear(false)}
              onRestore={() => handleClear(true)}
            />
          </motion.div>
        ) : (
          <motion.div
            key="calendrier"
            variants={prefersReduced ? undefined : fadeIn}
            initial="hidden"
            animate="visible"
            exit="hidden"
          >
            <CalendarView actions={actions} onDone={handleDone} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function CalendrierPageInner(props: CalendrierPageInnerProps) {
  return (
    <Suspense>
      <CalendrierContent {...props} />
    </Suspense>
  )
}
