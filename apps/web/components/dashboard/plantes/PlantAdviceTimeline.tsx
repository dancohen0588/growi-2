'use client'

import { useMemo } from 'react'
import { AlertTriangle } from 'lucide-react'
import type { PlantAdvice } from '@/lib/recommendation/types'
import { actionTypeDotColor, type ActionType } from '@/lib/mock-actions'

const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Août', 'Sep', 'Oct', 'Nov', 'Déc']

interface PlantAdviceTimelineProps {
  advice: PlantAdvice | null
}

export function PlantAdviceTimeline({ advice }: PlantAdviceTimelineProps) {
  const currentMonth = new Date().getMonth()

  /**
   * Les mois que chaque action occupe.
   *
   * Une action à fenêtre couvre toute sa période : la taille du rosier tient
   * septembre *et* octobre. La frise ne lisait que `dueDate` et posait donc un
   * seul point, à la fin de la fenêtre — elle annonçait la taille en octobre
   * pour une plante qu'on peut tailler dès septembre.
   */
  const tasksByMonth = useMemo(() => {
    const map = new Map<number, PlantAdvice['tasks']>()
    if (!advice) return map

    const push = (month: number, task: PlantAdvice['tasks'][number]) => {
      if (!map.has(month)) map.set(month, [])
      map.get(month)!.push(task)
    }

    for (const task of advice.tasks) {
      if (task.kind === 'window' && task.window) {
        const start = new Date(`${task.window.start}T00:00:00`)
        const end = new Date(`${task.window.end}T00:00:00`)
        // Une fenêtre qui enjambe le 31 décembre couvre les deux extrémités
        // de la frise, qui ne représente qu'une année.
        const span = Math.min(
          11,
          (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth(),
        )
        for (let i = 0; i <= span; i += 1) push((start.getMonth() + i) % 12, task)
        continue
      }
      push(new Date(`${task.dueDate}T00:00:00`).getMonth(), task)
    }

    return map
  }, [advice])

  if (!advice || (advice.tasks.length === 0 && advice.alerts.length === 0)) {
    return (
      <div className="rounded-2xl bg-white shadow-card p-6">
        <h2 className="font-poppins font-semibold text-lg text-forest mb-3">
          Conseils du moteur
        </h2>
        <p className="font-raleway text-forest/50 text-sm">
          Enrichis le catalogue pour obtenir des conseils personnalisés.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white shadow-card p-6 flex flex-col gap-5">
      <h2 className="font-poppins font-semibold text-lg text-forest">
        Planning recommandé
      </h2>

      {/* 12-month timeline */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {MONTHS.map((label, i) => {
          const tasks = tasksByMonth.get(i)
          const isNow = i === currentMonth

          return (
            <div
              key={i}
              className={`flex flex-col items-center gap-1 min-w-[3rem] px-1 py-2 rounded-lg text-xs font-raleway ${
                isNow ? 'bg-lime/20 font-semibold text-forest' : 'text-forest/50'
              }`}
            >
              <span>{label}</span>
              <div className="flex gap-0.5 flex-wrap justify-center min-h-[8px]">
                {tasks?.slice(0, 3).map((t: PlantAdvice['tasks'][number], j: number) => (
                  <span
                    key={j}
                    className={`w-2 h-2 rounded-full ${actionTypeDotColor[t.type as ActionType] ?? 'bg-gray-300'}`}
                    title={t.label}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Active alerts */}
      {advice.alerts.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="font-poppins font-medium text-sm text-forest/70 flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-amber-500" />
            Alertes actives
          </h3>
          {advice.alerts.map(alert => (
            <div
              key={alert.id}
              className={`rounded-lg px-3 py-2 font-raleway text-sm ${
                alert.severity === 'high'
                  ? 'bg-red-50 text-red-800'
                  : alert.severity === 'medium'
                    ? 'bg-amber-50 text-amber-800'
                    : 'bg-blue-50 text-blue-800'
              }`}
            >
              {alert.message}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
