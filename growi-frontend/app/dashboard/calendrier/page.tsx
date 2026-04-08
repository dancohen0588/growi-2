'use client'

import { useState, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { useReducedMotion } from 'framer-motion'
import { mockActions, GardenAction } from '@/lib/mock-actions'
import { getTemporalBucket } from '@/lib/calendar-utils'
import { CalendarViewToggle, type ActiveView } from '@/components/dashboard/calendrier/CalendarViewToggle'
import { TodoView } from '@/components/dashboard/calendrier/views/TodoView'
import { CalendarView } from '@/components/dashboard/calendrier/views/CalendarView'
import { useToast } from '@/components/ui/toast'
import { fadeIn } from '@/lib/animations'

function CalendrierPageInner() {
  const searchParams = useSearchParams()
  const activeView = (searchParams.get('vue') as ActiveView) ?? 'todo'
  const { toast } = useToast()
  const prefersReduced = useReducedMotion()

  const [actions, setActions] = useState<GardenAction[]>(mockActions)

  // Mark action as done (optimistic)
  const handleDone = useCallback(
    (id: string) => {
      setActions(prev =>
        prev.map(a =>
          a.id === id
            ? { ...a, done: true, doneAt: new Date().toISOString() }
            : a,
        ),
      )
      toast('✓ Action notée comme faite ! Ton jardin te remercie 🌱')
      // TODO: remplacer par API call PATCH /actions/:id { done: true }
    },
    [toast],
  )

  // Undo: mark action as not done
  const handleUndo = useCallback((id: string) => {
    setActions(prev =>
      prev.map(a => (a.id === id ? { ...a, done: false, doneAt: undefined } : a)),
    )
    // TODO: remplacer par API call PATCH /actions/:id { done: false }
  }, [])

  const doneActions = useMemo(
    () => actions.filter(a => a.done),
    [actions],
  )

  // Summary bar counts
  const todayDoneCount = useMemo(
    () =>
      actions.filter(
        a => a.done && a.doneAt && a.doneAt.startsWith(new Date().toISOString().slice(0, 10)),
      ).length,
    [actions],
  )
  const weekPendingCount = useMemo(
    () =>
      actions.filter(a => {
        if (a.done) return false
        const b = getTemporalBucket(a.dueDate)
        return b === 'today' || b === 'tomorrow' || b === 'this-week'
      }).length,
    [actions],
  )
  const monthPendingCount = useMemo(
    () =>
      actions.filter(a => !a.done && getTemporalBucket(a.dueDate) === 'this-month').length,
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

      {/* Summary bar */}
      <div className="rounded-xl bg-sand px-4 py-3 flex flex-wrap gap-x-5 gap-y-1 font-raleway text-sm text-forest/70">
        {todayDoneCount > 0 && (
          <span>✅ {todayDoneCount} faite{todayDoneCount > 1 ? 's' : ''} aujourd&apos;hui</span>
        )}
        <span>⏳ {weekPendingCount} à venir cette semaine</span>
        <span>📅 {monthPendingCount} ce mois</span>
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

export default function CalendrierPage() {
  return (
    <Suspense>
      <CalendrierPageInner />
    </Suspense>
  )
}
