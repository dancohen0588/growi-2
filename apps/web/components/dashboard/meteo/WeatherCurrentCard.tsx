// growi-frontend/components/dashboard/meteo/WeatherCurrentCard.tsx
'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { MapPin, Droplets, Wind, CloudRain, Sprout } from 'lucide-react'
import { getWeatherInfo } from '@/lib/weather-codes'
import { fadeUp } from '@/lib/animations'
import type { WeatherData } from '@/types/weather'

interface WeatherCurrentCardProps {
  data: WeatherData
}

function formatWindDirection(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO']
  return dirs[Math.round(deg / 45) % 8]
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

export function WeatherCurrentCard({ data }: WeatherCurrentCardProps) {
  const shouldReduceMotion = useReducedMotion()
  const { current, locationName } = data
  const info = getWeatherInfo(current.weatherCode)
  const WeatherIcon = info.icon

  return (
    <motion.div
      variants={shouldReduceMotion ? undefined : fadeUp}
      initial="hidden"
      animate="visible"
      className="rounded-2xl border border-forest/10 p-6 bg-gradient-to-br from-sand to-lime/15 shadow-card"
      aria-live="polite"
      aria-label={`Météo actuelle pour ${locationName}`}
    >
      {/* Header: location + date */}
      <div className="flex items-start justify-between gap-2 mb-5">
        <div className="flex items-center gap-1.5 text-forest/70 font-raleway text-sm">
          <MapPin size={14} aria-hidden className="shrink-0" />
          <span className="font-medium text-forest">{locationName}</span>
        </div>
        <span className="text-xs text-forest/50 font-raleway capitalize">
          {formatDate(current.time)}
        </span>
      </div>

      {/* Main weather display */}
      <div className="flex items-end gap-6 mb-6">
        <WeatherIcon
          size={72}
          aria-label={info.label}
          className="text-forest shrink-0"
          strokeWidth={1.5}
        />
        <div>
          <div className="text-6xl font-poppins font-bold text-forest leading-none">
            {Math.round(current.temperature)}°
          </div>
          <div className="font-raleway text-forest/60 text-sm mt-1">
            {info.label} · Ressenti {Math.round(current.apparentTemperature)}°C
          </div>
        </div>
      </div>

      {/* Weather metrics */}
      <div className="flex flex-wrap gap-x-5 gap-y-2 mb-5 font-raleway text-sm text-forest/70">
        <span className="flex items-center gap-1.5">
          <Droplets size={15} aria-hidden className="text-forest/50" />
          Humidité : <strong className="text-forest">{current.humidity}%</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <Wind size={15} aria-hidden className="text-forest/50" />
          Vent : <strong className="text-forest">{Math.round(current.windSpeed)} km/h {formatWindDirection(current.windDirection)}</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <CloudRain size={15} aria-hidden className="text-forest/50" />
          Précip. : <strong className="text-forest">{current.precipitation} mm</strong>
        </span>
      </div>

      {/* Garden tip */}
      <div className="flex items-start gap-3 rounded-xl bg-lime/30 px-4 py-3">
        <Sprout size={18} aria-hidden className="text-forest shrink-0 mt-0.5" />
        <p className="font-raleway text-sm text-forest leading-relaxed">
          {info.gardenTip}
        </p>
      </div>
    </motion.div>
  )
}
