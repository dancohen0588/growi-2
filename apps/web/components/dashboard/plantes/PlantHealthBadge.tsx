'use client'

import { healthStatusConfig, type HealthStatus } from '@/lib/plant-types'
import { cn } from '@/lib/utils'

interface PlantHealthBadgeProps {
  status: HealthStatus
  className?: string
}

export function PlantHealthBadge({ status, className }: PlantHealthBadgeProps) {
  const config = healthStatusConfig[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold font-raleway',
        config.color,
        className,
      )}
    >
      <span aria-hidden>{config.icon}</span>
      {config.label}
    </span>
  )
}
