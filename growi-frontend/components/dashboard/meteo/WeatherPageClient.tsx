// growi-frontend/components/dashboard/meteo/WeatherPageClient.tsx
'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { AlertCircle, MapPin, RefreshCw } from 'lucide-react'
import Link from 'next/link'

import { LocationModeSwitcher } from './LocationModeSwitcher'
import { AddressSearchBar } from './AddressSearchBar'
import { GeolocationButton } from './GeolocationButton'
import { WeatherCurrentCard } from './WeatherCurrentCard'
import { WeatherForecastRow } from './WeatherForecastRow'
import { WeatherGardenContextCard } from './WeatherGardenContextCard'
import { WeatherGardenTips } from './WeatherGardenTips'
import { WeatherSkeleton } from './WeatherSkeleton'

import { fetchWeatherByCoordinates } from '@/lib/weather-api'
import { buildGardenContext } from '@/lib/garden-context'
import { getUserPlants } from '@/lib/mock-plants'
import { mockWeatherData } from '@/lib/mock-weather'

import type { LocationMode, WeatherData, GardenContext, GeocodingResult } from '@/types/weather'
import type { UserAddress } from '@/lib/mock-users'

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_WEATHER === 'true'

interface WeatherPageClientProps {
  userAddress: UserAddress | null
  userId: string
}

type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied'

export function WeatherPageClient({ userAddress, userId }: WeatherPageClientProps) {
  const [mode, setMode] = useState<LocationMode>('account')
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [gardenContext, setGardenContext] = useState<GardenContext | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geoStatus, setGeoStatus] = useState<GeoStatus>('idle')

  const plants = useMemo(() => getUserPlants(userId), [userId])

  // ── Fetch weather and compute garden context ──────────────────────────────

  const loadWeather = useCallback(
    async (lat: number, lon: number, elevation?: number) => {
      setIsLoading(true)
      setError(null)
      setWeatherData(null)
      setGardenContext(null)

      try {
        let data: WeatherData

        if (USE_MOCK) {
          await new Promise((r) => setTimeout(r, 600)) // simulate network
          data = { ...mockWeatherData, fetchedAt: new Date().toISOString() }
        } else {
          data = await fetchWeatherByCoordinates(lat, lon)
        }

        setWeatherData(data)

        const ctx = buildGardenContext(lat, lon, elevation ?? data.elevation, data, plants)
        setGardenContext(ctx)
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'La météo est temporairement indisponible. Réessaie dans quelques instants.',
        )
      } finally {
        setIsLoading(false)
      }
    },
    [plants],
  )

  // ── Mode: account — auto-load on mount ───────────────────────────────────

  useEffect(() => {
    if (mode === 'account' && userAddress?.latitude && userAddress?.longitude) {
      void loadWeather(userAddress.latitude, userAddress.longitude)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  // ── Mode: search — load on address selection ──────────────────────────────

  function handleAddressSelect(result: GeocodingResult) {
    void loadWeather(result.latitude, result.longitude)
  }

  // ── Mode: geolocation ─────────────────────────────────────────────────────

  function requestGeolocation() {
    if (!navigator.geolocation) {
      setGeoStatus('denied')
      return
    }
    setGeoStatus('requesting')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoStatus('granted')
        void loadWeather(pos.coords.latitude, pos.coords.longitude)
      },
      () => {
        setGeoStatus('denied')
      },
      { timeout: 10000, maximumAge: 60000 },
    )
  }

  // ── Mode switch ───────────────────────────────────────────────────────────

  function handleModeChange(next: LocationMode) {
    setMode(next)
    setWeatherData(null)
    setGardenContext(null)
    setError(null)
    if (next !== 'geolocation') setGeoStatus('idle')
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {/* Page header */}
      <div>
        <h1 className="font-poppins font-bold text-2xl text-forest">Météo jardin</h1>
        <p className="font-raleway text-sm text-forest/60 mt-0.5">
          Consultez la météo locale pour optimiser l&apos;entretien de votre jardin.
        </p>
      </div>

      {/* Mode switcher */}
      <LocationModeSwitcher
        mode={mode}
        onChange={handleModeChange}
        hasAccountAddress={!!(userAddress?.latitude && userAddress?.longitude)}
      />

      {/* Mode-specific input */}
      {mode === 'account' && !userAddress?.latitude && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-forest/10 bg-white p-8 text-center">
          <MapPin size={32} aria-hidden className="text-forest/30" />
          <p className="font-poppins font-semibold text-forest">Aucune adresse configurée</p>
          <p className="font-raleway text-sm text-forest/60 max-w-xs leading-relaxed">
            Configure ton adresse dans tes paramètres pour obtenir la météo de ton jardin automatiquement.
          </p>
          <Link
            href="/dashboard/parametres"
            className="inline-flex items-center gap-2 rounded-xl bg-lime px-5 py-2.5 font-raleway font-semibold text-sm text-forest transition-colors hover:bg-lime/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest focus-visible:ring-offset-2"
          >
            Configurer mon adresse
          </Link>
        </div>
      )}

      {mode === 'search' && (
        <AddressSearchBar onSelect={handleAddressSelect} />
      )}

      {mode === 'geolocation' && geoStatus !== 'granted' && (
        <GeolocationButton status={geoStatus} onRequest={requestGeolocation} />
      )}

      {/* Loading skeleton */}
      {isLoading && <WeatherSkeleton />}

      {/* Error state */}
      {!isLoading && error && (
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-8 text-center"
        >
          <AlertCircle size={32} aria-hidden className="text-red-400" />
          <p className="font-poppins font-semibold text-forest">{error}</p>
          <button
            onClick={() => {
              if (mode === 'account' && userAddress?.latitude && userAddress?.longitude) {
                void loadWeather(userAddress.latitude, userAddress.longitude)
              } else if (mode === 'geolocation') {
                requestGeolocation()
              }
            }}
            className="inline-flex items-center gap-2 rounded-xl border border-forest/20 bg-white px-5 py-2.5 font-raleway text-sm text-forest transition-colors hover:bg-sand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime focus-visible:ring-offset-2"
          >
            <RefreshCw size={15} aria-hidden />
            Réessayer
          </button>
        </div>
      )}

      {/* Weather results */}
      {!isLoading && weatherData && (
        <>
          <WeatherCurrentCard data={weatherData} />
          {gardenContext && <WeatherGardenContextCard context={gardenContext} />}
          <WeatherForecastRow forecast={weatherData.forecast} />
          <WeatherGardenTips context={gardenContext} forecast={weatherData.forecast} />
        </>
      )}
    </div>
  )
}
