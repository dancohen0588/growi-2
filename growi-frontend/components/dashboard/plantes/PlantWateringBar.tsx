'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  type Plant,
  getDaysUntilWatering,
  getWateringProgress,
  getWateringBarColor,
} from '@/lib/mock-plants'

interface PlantWateringBarProps {
  plant: Plant
  showLabel?: boolean
  className?: string
}

export function PlantWateringBar({ plant, showLabel = true, className }: PlantWateringBarProps) {
  const [width, setWidth] = useState(0)
  const progress = getWateringProgress(plant)
  const daysUntil = getDaysUntilWatering(plant)
  const barColor = getWateringBarColor(progress)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setWidth(progress))
    return () => cancelAnimationFrame(raf)
  }, [progress])

  const isOverdue = daysUntil < 0
  const isToday = daysUntil === 0

  const label = isOverdue
    ? `En retard de ${Math.abs(daysUntil)} jour${Math.abs(daysUntil) > 1 ? 's' : ''} !`
    : isToday
    ? "À arroser aujourd'hui !"
    : `Prochain arrosage dans ${daysUntil} jour${daysUntil > 1 ? 's' : ''}`

  const labelClass = isOverdue || isToday ? 'text-red-600 font-semibold' : 'text-forest/60'

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div
        role="progressbar"
        aria-label={`Progression arrosage de ${plant.name}`}
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1.5 w-full rounded-full bg-forest/10 overflow-hidden"
      >
        <div
          className={cn(
            'h-full rounded-full transition-all duration-700 ease-out',
            barColor,
            progress >= 80 && 'animate-pulse',
          )}
          style={{ width: `${width}%` }}
        />
      </div>
      {showLabel && (
        <p className={cn('font-raleway text-xs', labelClass)}>{label}</p>
      )}
    </div>
  )
}
