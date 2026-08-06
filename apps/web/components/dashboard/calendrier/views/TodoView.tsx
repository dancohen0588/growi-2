'use client'

import { useMemo } from 'react'
import { GardenAction } from '@/lib/mock-actions'
import { getTemporalBucket } from '@/lib/calendar-utils'
import { TodaySection } from '../timeline/TodaySection'
import { TomorrowSection } from '../timeline/TomorrowSection'
import { ThisWeekSection } from '../timeline/ThisWeekSection'
import { ThisMonthSection } from '../timeline/ThisMonthSection'
import { LaterSection } from '../timeline/LaterSection'
import {
  Accordion, AccordionItem, AccordionTrigger, AccordionContent,
} from '@/components/ui/accordion'

interface TodoViewProps {
  actions: GardenAction[]
  doneActions: GardenAction[]
  onDone: (id: string) => void
  onUndo: (id: string) => void
}

export function TodoView({ actions, doneActions, onDone, onUndo }: TodoViewProps) {
  const pending = useMemo(
    () => actions.filter(a => !a.done),
    [actions],
  )

  const byBucket = useMemo(() => ({
    today:     pending.filter(a => getTemporalBucket(a.dueDate) === 'today'),
    tomorrow:  pending.filter(a => getTemporalBucket(a.dueDate) === 'tomorrow'),
    thisWeek:  pending.filter(a => getTemporalBucket(a.dueDate) === 'this-week'),
    thisMonth: pending.filter(a => getTemporalBucket(a.dueDate) === 'this-month'),
    later:     pending.filter(a => getTemporalBucket(a.dueDate) === 'later'),
  }), [pending])

  return (
    <div className="flex flex-col gap-8">
      <TodaySection actions={byBucket.today} onDone={onDone} />

      <div className="h-px bg-forest/10" aria-hidden />

      <TomorrowSection actions={byBucket.tomorrow} onDone={onDone} />

      <div className="h-px bg-forest/10" aria-hidden />

      <ThisWeekSection actions={byBucket.thisWeek} onDone={onDone} />

      {byBucket.thisMonth.length > 0 && (
        <>
          <div className="h-px bg-forest/10" aria-hidden />
          <ThisMonthSection actions={byBucket.thisMonth} onDone={onDone} />
        </>
      )}

      {byBucket.later.length > 0 && (
        <>
          <div className="h-px bg-forest/10" aria-hidden />
          <LaterSection actions={byBucket.later} />
        </>
      )}

      {/* Done accordion */}
      {doneActions.length > 0 && (
        <>
          <div className="h-px bg-forest/10" aria-hidden />
          <section aria-labelledby="done-heading">
            <Accordion type="single">
              <AccordionItem value="done">
                <AccordionTrigger>
                  <span id="done-heading" className="font-poppins font-semibold text-forest/60 text-sm">
                    ✅ Actions réalisées ({doneActions.length})
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="pt-2">
                    {doneActions.map(a => (
                      <div
                        key={a.id}
                        className="flex items-center gap-3 py-2.5 border-b border-forest/10 last:border-0 opacity-60"
                      >
                        <span className="flex-1 font-raleway text-sm text-forest line-through">
                          {a.label}
                        </span>
                        <button
                          onClick={() => onUndo(a.id)}
                          className="font-raleway text-xs text-forest/60 underline underline-offset-2 hover:text-forest transition-colors"
                        >
                          Annuler
                        </button>
                      </div>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </section>
        </>
      )}
    </div>
  )
}
