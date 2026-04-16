'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import type { PlantAlert } from '@/lib/recommendation/types'

const alertEmoji: Record<PlantAlert['type'], string> = {
  gel: '❄️',
  canicule: '🌡️',
  secheresse: '🌵',
  maladie: '🦠',
}

const severityStyles: Record<PlantAlert['severity'], string> = {
  high: 'bg-red-50 border-red-200 text-red-800',
  medium: 'bg-amber-50 border-amber-200 text-amber-800',
  low: 'bg-blue-50 border-blue-200 text-blue-800',
}

interface WeatherAlertBannerProps {
  alerts: PlantAlert[]
}

export function WeatherAlertBanner({ alerts }: WeatherAlertBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed || alerts.length === 0) return null

  // Group alerts by type
  const grouped = alerts.reduce<Record<string, PlantAlert[]>>((acc, alert) => {
    const key = alert.type
    if (!acc[key]) acc[key] = []
    acc[key].push(alert)
    return acc
  }, {})

  // Use highest severity for banner style
  const maxSeverity = alerts.some(a => a.severity === 'high')
    ? 'high'
    : alerts.some(a => a.severity === 'medium')
      ? 'medium'
      : 'low'

  return (
    <div
      className={`rounded-xl border px-4 py-3 flex items-start gap-3 ${severityStyles[maxSeverity]}`}
      role="alert"
      data-testid="weather-alert-banner"
    >
      <div className="flex-1 flex flex-wrap gap-2">
        {Object.entries(grouped).map(([type, groupAlerts]) => {
          const emoji = alertEmoji[type as PlantAlert['type']] ?? '⚠️'
          const count = groupAlerts.length

          return (
            <span
              key={type}
              className="inline-flex items-center gap-1.5 rounded-full bg-white/60 px-3 py-1 font-raleway text-sm font-medium"
            >
              <span>{emoji}</span>
              {count > 1
                ? `${groupAlerts[0].message.split('—')[0].trim()} — ${count} plantes concernées`
                : groupAlerts[0].message}
            </span>
          )
        })}
      </div>

      <button
        onClick={() => setDismissed(true)}
        className="shrink-0 p-1 rounded-lg hover:bg-white/50 transition-colors"
        aria-label="Fermer les alertes"
      >
        <X size={16} />
      </button>
    </div>
  )
}
