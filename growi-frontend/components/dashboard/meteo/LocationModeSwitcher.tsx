// growi-frontend/components/dashboard/meteo/LocationModeSwitcher.tsx
'use client'

import { Home, Search, MapPin } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LocationMode } from '@/types/weather'

interface LocationModeSwitcherProps {
  mode: LocationMode
  onChange: (mode: LocationMode) => void
  hasAccountAddress: boolean
}

const modes: Array<{
  value: LocationMode
  label: string
  icon: React.ElementType
  ariaLabel: string
}> = [
  { value: 'account', label: 'Mon adresse', icon: Home, ariaLabel: 'Météo basée sur mon adresse de compte' },
  { value: 'search', label: 'Rechercher', icon: Search, ariaLabel: 'Rechercher une adresse manuellement' },
  { value: 'geolocation', label: 'Ma position', icon: MapPin, ariaLabel: 'Utiliser ma position GPS' },
]

export function LocationModeSwitcher({ mode, onChange, hasAccountAddress }: LocationModeSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Mode de localisation météo"
      className="flex gap-2 p-1 rounded-xl bg-sand border border-forest/10"
    >
      {modes.map(({ value, label, icon: Icon, ariaLabel }) => {
        const active = mode === value
        const disabled = value === 'account' && !hasAccountAddress

        return (
          <button
            key={value}
            role="tab"
            aria-selected={active}
            aria-label={ariaLabel}
            disabled={disabled}
            onClick={() => !disabled && onChange(value)}
            className={cn(
              'flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 font-raleway text-sm transition-all duration-200 min-h-[44px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-1',
              active
                ? 'bg-forest text-sand font-semibold shadow-sm'
                : disabled
                  ? 'text-forest/30 cursor-not-allowed'
                  : 'text-forest/60 border border-forest/20 hover:border-forest/50 hover:text-forest hover:bg-white/60',
            )}
          >
            <Icon size={15} aria-hidden />
            <span className="hidden sm:inline">{label}</span>
          </button>
        )
      })}
    </div>
  )
}
