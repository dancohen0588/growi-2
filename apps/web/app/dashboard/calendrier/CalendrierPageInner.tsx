'use client'

import { useState, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { useReducedMotion } from 'framer-motion'
import type { GardenAction } from '@/lib/mock-actions'
import type { PlantAlert } from '@/lib/recommendation/types'
import { groupActionsByHorizon } from '@growi/shared'
import { CalendarViewToggle, type ActiveView } from '@/components/dashboard/calendrier/CalendarViewToggle'
import { TodoView } from '@/components/dashboard/calendrier/views/TodoView'
import { CalendarView } from '@/components/dashboard/calendrier/views/CalendarView'
import { WeatherAlertBanner } from '@/components/dashboard/calendrier/WeatherAlertBanner'
import { markActionDoneAction } from '@/app/actions/advice.actions'
import { useToast } from '@/components/ui/toast'
import { fadeIn } from '@/lib/animations'

interface CalendrierPageInnerProps {
  initialActions: GardenAction[]
  alerts: PlantAlert[]
  gardenId: string
}

function CalendrierContent({ initialActions, alerts, gardenId }: CalendrierPageInnerProps) {
  const searchParams = useSearchParams()
  const activeView = (searchParams.get('vue') as ActiveView) ?? 'todo'
  const { toast } = useToast()
  const prefersReduced = useReducedMotion()

  const [actions, setActions] = useState<GardenAction[]>(initialActions)

  // Mark action as done (optimistic + persist)
  const handleDone = useCallback(
    (id: string) => {
      const action = actions.find(a => a.id === id)

      // Optimistic UI update
      setActions(prev =>
        prev.map(a =>
          a.id === id
            ? { ...a, done: true, doneAt: new Date().toISOString() }
            : a,
        ),
      )
      toast('✓ Action notée comme faite ! Ton jardin te remercie 🌱')

      // Persist to database
      markActionDoneAction(id, gardenId, action?.type, action?.plantId).catch(() => {
        // Revert on failure
        setActions(prev =>
          prev.map(a =>
            a.id === id ? { ...a, done: false, doneAt: undefined } : a,
          ),
        )
        toast('Erreur lors de la sauvegarde. Réessaie.')
      })
    },
    [actions, gardenId, toast],
  )

  // Undo: mark action as not done
  const handleUndo = useCallback((id: string) => {
    setActions(prev =>
      prev.map(a => (a.id === id ? { ...a, done: false, doneAt: undefined } : a)),
    )
    // TODO: persist undo (reverse the log entry)
  }, [])

  const doneActions = useMemo(
    () => actions.filter(a => a.done),
    [actions],
  )

  // Summary bar counts — mêmes horizons que les sections et que le mobile.
  const todayDoneCount = useMemo(
    () =>
      actions.filter(
        a => a.done && a.doneAt && a.doneAt.startsWith(new Date().toISOString().slice(0, 10)),
      ).length,
    [actions],
  )
  const pendingByHorizon = useMemo(
    () => groupActionsByHorizon(actions.filter(a => !a.done)),
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
            Tes prochaines actions, du plus urgent au plus lointain.
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
        {todayDoneCount > 0 && (
          <span>✅ {todayDoneCount} faite{todayDoneCount > 1 ? 's' : ''} aujourd&apos;hui</span>
        )}
        <span>🌱 {pendingByHorizon.today.length} aujourd&apos;hui</span>
        <span>⏳ {pendingByHorizon.tomorrow.length} demain</span>
        <span>📅 {pendingByHorizon.later.length} plus tard</span>
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
              doneActions={doneActions}
              onDone={handleDone}
              onUndo={handleUndo}
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
