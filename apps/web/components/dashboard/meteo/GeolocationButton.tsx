// growi-frontend/components/dashboard/meteo/GeolocationButton.tsx
'use client'

import { MapPin, Loader2, AlertTriangle } from 'lucide-react'

type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied'

interface GeolocationButtonProps {
  status: GeoStatus
  onRequest: () => void
}

export function GeolocationButton({ status, onRequest }: GeolocationButtonProps) {
  if (status === 'granted') return null

  if (status === 'denied') {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-4 rounded-2xl border border-sun/40 bg-sun/10 p-8 text-center"
      >
        <AlertTriangle size={36} aria-hidden className="text-sun" />
        <div>
          <p className="font-poppins font-semibold text-forest mb-1">
            Accès à la position refusé
          </p>
          <p className="font-raleway text-sm text-forest/70 max-w-xs mx-auto leading-relaxed">
            Tu as refusé l&apos;accès à ta position. Pour activer la géolocalisation, rends-toi dans les paramètres de ton navigateur et autorise l&apos;accès à la localisation pour ce site.
          </p>
        </div>
        <button
          onClick={onRequest}
          className="inline-flex items-center gap-2 rounded-xl border border-forest/20 bg-white px-5 py-2.5 font-raleway text-sm text-forest transition-colors hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
          aria-label="Réessayer la géolocalisation"
        >
          <MapPin size={15} aria-hidden />
          Réessayer
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <p className="font-raleway text-sm text-forest/60 text-center">
        Utilise ta position GPS pour obtenir la météo de ton emplacement exact.
      </p>
      <button
        onClick={onRequest}
        disabled={status === 'requesting'}
        aria-busy={status === 'requesting'}
        className="inline-flex items-center gap-3 rounded-xl bg-lime px-6 py-3 font-poppins font-semibold text-forest shadow-cta transition-all hover:bg-lime/90 hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2 disabled:opacity-70 disabled:cursor-not-allowed min-h-[44px]"
      >
        {status === 'requesting' ? (
          <>
            <Loader2 size={18} aria-hidden className="animate-spin" />
            Localisation en cours…
          </>
        ) : (
          <>
            <MapPin size={18} aria-hidden />
            Utiliser ma position actuelle
          </>
        )}
      </button>

      {typeof window !== 'undefined' && !window.isSecureContext && (
        <p
          role="alert"
          className="font-raleway text-xs text-red-500 text-center"
        >
          La géolocalisation nécessite une connexion sécurisée (HTTPS).
        </p>
      )}
    </div>
  )
}
