'use client'

import { useMemo } from 'react'
import { ACTION_HORIZONS, groupActionsByHorizon } from '@growi/shared'
import { GardenAction } from '@/lib/mock-actions'
import { HorizonSection } from '../timeline/HorizonSection'
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
  // Le rangement par échéance vient de @growi/shared : le mobile applique
  // exactement les mêmes règles, retard compris.
  const byHorizon = useMemo(
    () => groupActionsByHorizon(actions.filter((a) => !a.done)),
    [actions],
  )

  return (
    <div className="flex flex-col gap-8">
      {ACTION_HORIZONS.map((horizon, index) => {
        // Les sections lointaines vides ne méritent pas d'occuper l'écran ;
        // celle du jour, si, pour dire que la journée est faite.
        if (horizon !== 'today' && byHorizon[horizon].length === 0) return null

        return (
          <div key={horizon} className="flex flex-col gap-8">
            {index > 0 && <div className="h-px bg-forest/10" aria-hidden />}
            <HorizonSection horizon={horizon} actions={byHorizon[horizon]} onDone={onDone} />
          </div>
        )
      })}

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
