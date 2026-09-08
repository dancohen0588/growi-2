'use client'

import { useMemo, useState } from 'react'
import { ACTION_HORIZONS, groupActionsByHorizon } from '@growi/shared'
import { GardenAction } from '@/lib/mock-actions'
import { ActionDetailDialog } from '../ActionDetailDialog'
import { DoneTodayList } from '../DoneTodayList'
import { HorizonSection } from '../timeline/HorizonSection'

interface TodoViewProps {
  actions: GardenAction[]
  /** Les gestes notés aujourd'hui, chacun avec son `careLogId`. */
  doneToday: GardenAction[]
  /** Au moins un jardin est en pause pour aujourd'hui. */
  cleared: boolean
  onDone: (id: string) => void
  onDoneMany: (actions: GardenAction[]) => void
  onUndo: (action: GardenAction) => void
  onClearToday: () => void
  onRestore: () => void
}

export function TodoView({
  actions,
  doneToday,
  cleared,
  onDone,
  onDoneMany,
  onUndo,
  onClearToday,
  onRestore,
}: TodoViewProps) {
  // Le rangement par échéance vient de @growi/shared : le mobile applique
  // exactement les mêmes règles, retard et fenêtres compris.
  const byHorizon = useMemo(
    () => groupActionsByHorizon(actions.filter((a) => !a.done)),
    [actions],
  )

  const [detail, setDetail] = useState<GardenAction | null>(null)

  return (
    <div className="flex flex-col gap-8">
      {ACTION_HORIZONS.map((horizon, index) => {
        // Les sections lointaines vides ne méritent pas d'occuper l'écran ;
        // celle du jour, si, pour dire que la journée est faite.
        if (horizon !== 'today' && byHorizon[horizon].length === 0) return null

        return (
          <div key={horizon} className="flex flex-col gap-8">
            {index > 0 && <div className="h-px bg-forest/10" aria-hidden />}
            <HorizonSection
              horizon={horizon}
              actions={byHorizon[horizon]}
              onDone={onDone}
              onDoneMany={onDoneMany}
              onOpenDetail={setDetail}
              onClearToday={horizon === 'today' ? onClearToday : undefined}
              cleared={horizon === 'today' ? cleared : undefined}
              onRestore={onRestore}
            />
          </div>
        )
      })}

      {doneToday.length > 0 && (
        <>
          <div className="h-px bg-forest/10" aria-hidden />
          <DoneTodayList actions={doneToday} onUndo={onUndo} />
        </>
      )}

      <ActionDetailDialog
        action={detail}
        open={detail !== null}
        onOpenChange={(open) => !open && setDetail(null)}
        onDone={onDone}
      />
    </div>
  )
}
