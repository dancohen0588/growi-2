'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { LayoutList, CalendarDays } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ActiveView = 'todo' | 'calendrier'

interface CalendarViewToggleProps {
  activeView: ActiveView
}

export function CalendarViewToggle({ activeView }: CalendarViewToggleProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  function switchTo(view: ActiveView) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('vue', view)
    router.push(`${pathname}?${params.toString()}`)
  }

  const pillBase =
    'flex items-center gap-2 px-4 py-2 rounded-full font-raleway text-sm font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime'

  return (
    <div
      role="group"
      aria-label="Choisir la vue"
      className="flex gap-1 bg-white border border-forest/10 rounded-full p-1 shadow-card"
    >
      <button
        onClick={() => switchTo('todo')}
        aria-pressed={activeView === 'todo'}
        className={cn(
          pillBase,
          activeView === 'todo'
            ? 'bg-forest text-white'
            : 'text-forest hover:bg-sand',
        )}
      >
        <LayoutList size={16} aria-hidden />
        Liste
      </button>
      <button
        onClick={() => switchTo('calendrier')}
        aria-pressed={activeView === 'calendrier'}
        className={cn(
          pillBase,
          activeView === 'calendrier'
            ? 'bg-forest text-white'
            : 'text-forest hover:bg-sand',
        )}
      >
        <CalendarDays size={16} aria-hidden />
        Calendrier
      </button>
    </div>
  )
}
