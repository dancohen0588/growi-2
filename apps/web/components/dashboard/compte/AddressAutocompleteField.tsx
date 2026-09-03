// growi-frontend/components/dashboard/compte/AddressAutocompleteField.tsx
'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { MapPin, Loader2 } from 'lucide-react'
import { reverseGeocode } from '@/lib/weather-api'

interface GeocodeFeature {
  properties: {
    label?: string
    name?: string
    postcode?: string
    city?: string
    /** Code commune INSEE — absent hors de France. */
    citycode?: string
  }
  geometry: {
    coordinates: [number, number] // [lon, lat]
  }
}

interface GeocodeResponse {
  features?: GeocodeFeature[]
}

type GeoStatus = 'idle' | 'loading' | 'denied' | 'unsupported'

interface AddressAutocompleteFieldProps {
  value: string
  /**
   * `citycode` est le code commune INSEE de l'adresse choisie, `null` quand
   * il n'y en a pas — c'est ce qui permet à l'import cadastral de reconnaître
   * une adresse hors de France sans interroger l'IGN pour rien.
   */
  onChange: (
    label: string,
    lat: number | null,
    lon: number | null,
    citycode?: string | null,
  ) => void
  id?: string
  placeholder?: string
  disabled?: boolean
}

export function AddressAutocompleteField({
  value,
  onChange,
  id,
  placeholder = 'Ex : 14 rue des Lilas, Lyon',
  disabled = false,
}: AddressAutocompleteFieldProps) {
  const [suggestions, setSuggestions] = useState<GeocodeFeature[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isFetching, setIsFetching] = useState(false)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle')
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Recherche d'adresses, avec anti-rebond, sur le géocodeur de la Géoplateforme.
  // `api-adresse.data.gouv.fr` a été transféré à l'IGN et redirige ici en
  // attendant son extinction ; le format de réponse est identique.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!value || value.trim().length < 3) {
      setSuggestions([])
      setIsOpen(false)
      return
    }

    debounceRef.current = setTimeout(async () => {
      setIsFetching(true)
      try {
        const params = new URLSearchParams({
          q: value.trim(),
          limit: '5',
          autocomplete: '1',
        })
        const res = await fetch(
          `https://data.geopf.fr/geocodage/search?${params.toString()}`,
        )
        if (!res.ok) throw new Error('Géocodage indisponible')
        const json = (await res.json()) as GeocodeResponse
        const feats = json.features ?? []
        setSuggestions(feats)
        setIsOpen(feats.length > 0)
      } catch {
        setSuggestions([])
        setIsOpen(false)
      } finally {
        setIsFetching(false)
      }
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [value])

  // Close dropdown on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleMouseDown)
    return () => document.removeEventListener('mousedown', handleMouseDown)
  }, [])

  function getSuggestionLabel(feat: GeocodeFeature): string {
    const p = feat.properties
    if (p.label) return p.label
    return [p.name, p.postcode, p.city].filter(Boolean).join(' ')
  }

  function handleSelect(feat: GeocodeFeature) {
    const label = getSuggestionLabel(feat)
    const lon = feat.geometry.coordinates[0]
    const lat = feat.geometry.coordinates[1]
    onChange(label, lat, lon, feat.properties.citycode ?? null)
    setSuggestions([])
    setIsOpen(false)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Manual typing: coords cleared to signal re-geocode needed
    onChange(e.target.value, null, null)
  }

  const handleGeolocate = useCallback(async () => {
    if (!navigator.geolocation) {
      setGeoStatus('unsupported')
      return
    }
    setGeoStatus('loading')
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const label = await reverseGeocode(pos.coords.latitude, pos.coords.longitude)
          onChange(label, pos.coords.latitude, pos.coords.longitude)
          setGeoStatus('idle')
          setSuggestions([])
          setIsOpen(false)
        } catch {
          onChange(
            `${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`,
            pos.coords.latitude,
            pos.coords.longitude,
          )
          setGeoStatus('idle')
        }
      },
      () => {
        setGeoStatus('denied')
      },
      { timeout: 10000, maximumAge: 60000 },
    )
  }, [onChange])

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            id={id}
            type="text"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={isOpen}
            value={value}
            onChange={handleInputChange}
            onFocus={() => suggestions.length > 0 && setIsOpen(true)}
            onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
            placeholder={placeholder}
            disabled={disabled}
            className="w-full rounded-xl border border-forest/20 bg-white px-3.5 py-2.5 font-raleway text-sm text-forest placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-2 focus:border-transparent transition-shadow hover:shadow-card disabled:opacity-50 disabled:cursor-not-allowed"
          />
          {isFetching && (
            <Loader2
              size={15}
              aria-hidden
              className="absolute right-3 top-1/2 -translate-y-1/2 text-forest/40 animate-spin"
            />
          )}
        </div>

        {/* Geolocation button */}
        <button
          type="button"
          onClick={handleGeolocate}
          disabled={disabled || geoStatus === 'loading'}
          aria-label="Utiliser ma position"
          title="Utiliser ma position GPS"
          className="flex items-center gap-1.5 rounded-xl border border-forest/20 bg-white px-3 py-2.5 font-raleway text-sm text-forest/70 hover:bg-lime/10 hover:text-forest hover:border-lime/50 focus:outline-none focus:ring-2 focus:ring-lime focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
        >
          {geoStatus === 'loading' ? (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          ) : (
            <MapPin size={15} aria-hidden />
          )}
          <span className="hidden sm:inline">
            {geoStatus === 'loading' ? 'Localisation…' : 'Ma position'}
          </span>
        </button>
      </div>

      {/* Suggestions dropdown */}
      {isOpen && suggestions.length > 0 && (
        <ul
          role="listbox"
          aria-label="Suggestions d'adresses"
          className="absolute z-50 mt-1.5 w-full bg-sand border border-forest/20 rounded-xl shadow-card-hover overflow-hidden"
        >
          {suggestions.map((feat, i) => {
            const label = getSuggestionLabel(feat)
            return (
              <li
                key={`${label}-${i}`}
                role="option"
                aria-selected={false}
                tabIndex={0}
                onClick={() => handleSelect(feat)}
                onKeyDown={(e) =>
                  (e.key === 'Enter' || e.key === ' ') && handleSelect(feat)
                }
                className="flex flex-col px-4 py-2.5 cursor-pointer font-raleway text-sm text-forest hover:bg-lime/20 focus:bg-lime/20 focus:outline-none transition-colors border-b border-forest/5 last:border-0"
              >
                <span className="font-medium">{label}</span>
              </li>
            )
          })}
        </ul>
      )}

      {/* Error states */}
      {geoStatus === 'denied' && (
        <p className="mt-1.5 text-xs text-red-500 font-raleway">
          La géolocalisation a été refusée. Autorise-la dans les paramètres de ton navigateur.
        </p>
      )}
      {geoStatus === 'unsupported' && (
        <p className="mt-1.5 text-xs text-forest/50 font-raleway">
          La géolocalisation n&apos;est pas supportée par ce navigateur.
        </p>
      )}
    </div>
  )
}
