'use client'

import { useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from '@/components/ui/sheet'
import { GardenAction, actionTypeDotColor } from '@/lib/mock-actions'
import { ActionCardMedium } from '../cards/ActionCardMedium'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim']

function isoDate(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

/** 0=Mon … 6=Sun (ISO week) */
function getFirstDayOfWeek(year: number, month: number): number {
  const d = new Date(year, month, 1).getDay()
  return d === 0 ? 6 : d - 1
}

interface CalendarViewProps {
  actions: GardenAction[]
  onDone: (id: string) => void
}

export function CalendarView({ actions, onDone }: CalendarViewProps) {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)

  // Build map: isoDate → GardenAction[]
  const actionsByDate = useMemo(() => {
    const map = new Map<string, GardenAction[]>()
    for (const a of actions) {
      if (!map.has(a.dueDate)) map.set(a.dueDate, [])
      map.get(a.dueDate)!.push(a)
    }
    return map
  }, [actions])

  const todayIso = isoDate(today.getFullYear(), today.getMonth(), today.getDate())

  const monthLabel = new Date(year, month).toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  function goToday() {
    setYear(today.getFullYear())
    setMonth(today.getMonth())
  }

  const selectedActions = selectedDate ? (actionsByDate.get(selectedDate) ?? []) : []

  // All cells: leading blanks + day numbers
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]

  // Pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <>
      <div className="bg-white rounded-2xl shadow-card p-5">
        {/* Navigation */}
        <div className="flex items-center justify-between mb-5">
          <Button variant="ghost" size="icon" onClick={prevMonth} aria-label="Mois précédent">
            <ChevronLeft size={18} aria-hidden />
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="font-poppins font-bold text-forest text-lg capitalize">
              {monthLabel}
            </h2>
            <button
              onClick={goToday}
              className="font-raleway text-xs text-forest/60 border border-forest/20 rounded-full px-2.5 py-0.5 hover:bg-sand transition-colors"
            >
              Aujourd&apos;hui
            </button>
          </div>
          <Button variant="ghost" size="icon" onClick={nextMonth} aria-label="Mois suivant">
            <ChevronRight size={18} aria-hidden />
          </Button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 mb-2">
          {WEEKDAYS.map(d => (
            <div
              key={d}
              className="text-center font-raleway text-xs font-semibold text-forest/40 py-1"
            >
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 gap-px bg-forest/5 rounded-xl overflow-hidden">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={`blank-${idx}`} className="bg-white min-h-[56px]" />
            }

            const iso = isoDate(year, month, day)
            const dayActions = actionsByDate.get(iso) ?? []
            const isToday = iso === todayIso
            const isPast = iso < todayIso

            const visibleDots = dayActions.slice(0, 3)
            const extraCount = dayActions.length - 3

            return (
              <button
                key={iso}
                onClick={() => dayActions.length > 0 && setSelectedDate(iso)}
                aria-label={`${day} ${monthLabel}${dayActions.length > 0 ? `, ${dayActions.length} action${dayActions.length > 1 ? 's' : ''}` : ''}`}
                className={cn(
                  'bg-white min-h-[56px] flex flex-col items-center pt-2 pb-1 gap-1 transition-colors',
                  dayActions.length > 0 && 'cursor-pointer hover:bg-sand',
                  dayActions.length === 0 && 'cursor-default',
                  isToday && 'bg-lime/20',
                  isPast && !isToday && 'bg-forest/[0.02]',
                )}
              >
                <span
                  className={cn(
                    'font-poppins text-sm font-semibold',
                    isToday ? 'text-forest' : isPast ? 'text-forest/30' : 'text-forest/80',
                  )}
                >
                  {day}
                </span>

                {/* Dots */}
                {visibleDots.length > 0 && (
                  <div className="flex items-center gap-0.5 flex-wrap justify-center">
                    {visibleDots.map(a => (
                      <span
                        key={a.id}
                        className={cn('w-1.5 h-1.5 rounded-full', actionTypeDotColor[a.type])}
                        aria-hidden
                      />
                    ))}
                    {extraCount > 0 && (
                      <span className="font-raleway text-[9px] text-forest/40">+{extraCount}</span>
                    )}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap gap-3">
          {([
            ['arrosage',     'bg-blue-400',    'Arrosage'],
            ['taille',       'bg-forest',      'Taille'],
            ['semis',        'bg-lime',        'Semis'],
            ['rempotage',    'bg-amber-500',   'Rempotage'],
            ['fertilisation','bg-purple-400',  'Fertilisation'],
            ['traitement',   'bg-red-400',     'Traitement'],
            ['recolte',      'bg-sun',         'Récolte'],
          ] as [string, string, string][]).map(([, colorClass, label]) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={cn('w-2 h-2 rounded-full shrink-0', colorClass)} aria-hidden />
              <span className="font-raleway text-xs text-forest/60">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Day sheet */}
      <Sheet open={!!selectedDate} onOpenChange={open => !open && setSelectedDate(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="font-poppins text-forest capitalize">
              {selectedDate
                ? new Date(selectedDate).toLocaleDateString('fr-FR', {
                    weekday: 'long', day: 'numeric', month: 'long',
                  })
                : ''}
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-3 pb-6">
            {selectedActions.map(a => (
              <ActionCardMedium key={a.id} action={a} onDone={id => { onDone(id); setSelectedDate(null) }} />
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
