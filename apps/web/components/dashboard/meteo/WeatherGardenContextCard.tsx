// growi-frontend/components/dashboard/meteo/WeatherGardenContextCard.tsx
'use client'

import { motion, useReducedMotion } from 'framer-motion'
import {
  Globe,
  Leaf,
  Mountain,
  Thermometer,
  Droplets,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Info,
} from 'lucide-react'
import { fadeUp } from '@/lib/animations'
import { cn } from '@/lib/utils'
import type { GardenContext, PlantWeatherAlert } from '@/types/weather'

interface WeatherGardenContextCardProps {
  context: GardenContext
}

function WateringBar({ score }: { score: number }) {
  const pct = (score / 10) * 100
  const color =
    score <= 3 ? 'bg-lime'
    : score <= 6 ? 'bg-sun'
    : 'bg-red-400'

  return (
    <div
      className="mt-2 h-2 w-full rounded-full bg-forest/10"
      role="progressbar"
      aria-valuenow={score}
      aria-valuemin={0}
      aria-valuemax={10}
      aria-label={`Index d'arrosage : ${score}/10`}
    >
      <div
        className={cn('h-2 rounded-full transition-all duration-500', color)}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function AlertItem({ alert }: { alert: PlantWeatherAlert }) {
  const styles: Record<PlantWeatherAlert['severity'], string> = {
    info: 'bg-lime/10 border border-lime/30',
    warning: 'bg-sun/20 border border-sun/40',
    critical: 'bg-red-50 border border-red-200',
  }

  const Icon = alert.severity === 'critical' ? AlertCircle
    : alert.severity === 'warning' ? AlertTriangle
    : Info

  const iconColor = alert.severity === 'critical' ? 'text-red-500'
    : alert.severity === 'warning' ? 'text-sun'
    : 'text-forest/50'

  return (
    <div className={cn('flex items-start gap-3 rounded-xl p-3', styles[alert.severity])}>
      <Icon size={16} aria-hidden className={cn('shrink-0 mt-0.5', iconColor)} />
      <p className="font-raleway text-sm text-forest leading-relaxed">
        {alert.message}
      </p>
    </div>
  )
}

const frostColors: Record<string, string> = {
  none: 'text-lime',
  low: 'text-sun',
  moderate: 'text-orange-500',
  high: 'text-red-500',
}

export function WeatherGardenContextCard({ context }: WeatherGardenContextCardProps) {
  const shouldReduceMotion = useReducedMotion()
  const {
    climateZoneLabel,
    gardenSeasonLabel,
    elevation,
    frostRisk,
    wateringIndex,
    plantAlerts,
  } = context

  return (
    <motion.div
      variants={shouldReduceMotion ? undefined : fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      transition={{ delay: 0.2 }}
      className="rounded-2xl border border-forest/10 bg-white p-6 shadow-card space-y-5"
    >
      {/* Title */}
      <div className="flex items-center gap-2">
        <Globe size={18} aria-hidden className="text-forest" />
        <h3 className="font-poppins font-semibold text-forest text-base">Ton contexte jardin</h3>
      </div>

      {/* Zone / season / elevation badges */}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex items-center gap-1.5 bg-lime/20 text-forest text-sm rounded-full px-3 py-1 font-raleway">
          <Globe size={13} aria-hidden />
          {climateZoneLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 bg-lime/20 text-forest text-sm rounded-full px-3 py-1 font-raleway">
          <Leaf size={13} aria-hidden />
          {gardenSeasonLabel}
        </span>
        <span className="inline-flex items-center gap-1.5 bg-lime/20 text-forest text-sm rounded-full px-3 py-1 font-raleway">
          <Mountain size={13} aria-hidden />
          {elevation} m
        </span>
      </div>

      {/* Watering + frost grid */}
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Watering index */}
        <div className="flex-1 rounded-xl bg-sand/60 p-4 space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <Droplets size={16} aria-hidden className="text-forest/70" />
            <span className="font-poppins font-semibold text-forest text-sm">Arrosage</span>
          </div>
          <div className="font-raleway text-2xl font-bold text-forest">
            {wateringIndex.score}<span className="text-base font-normal text-forest/50">/10</span>
          </div>
          <WateringBar score={wateringIndex.score} />
          <p className="font-raleway text-xs text-forest/60 pt-1 leading-snug">
            {wateringIndex.label}
          </p>
          <p className="font-raleway text-xs text-forest/40 italic leading-snug">
            {wateringIndex.reasoning}
          </p>
        </div>

        {/* Frost risk */}
        <div className="flex-1 rounded-xl bg-sand/60 p-4 space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <Thermometer
              size={16}
              aria-hidden
              className={cn('shrink-0', frostColors[frostRisk.level])}
            />
            <span className="font-poppins font-semibold text-forest text-sm">Risque de gel</span>
          </div>
          <div className={cn('font-raleway text-sm font-semibold', frostColors[frostRisk.level])}>
            {frostRisk.level === 'none' ? 'Aucun' :
              frostRisk.level === 'low' ? 'Faible' :
              frostRisk.level === 'moderate' ? 'Modéré' : 'Élevé'}
          </div>
          <p className="font-raleway text-xs text-forest/60 leading-snug">
            {frostRisk.label}
          </p>
          {frostRisk.affectedNights > 0 && (
            <p className="font-raleway text-xs text-forest/40 italic">
              Min. prévue : {frostRisk.minTemp.toFixed(1)}°C
            </p>
          )}
        </div>
      </div>

      {/* Plant alerts */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle size={16} aria-hidden className="text-forest/70" />
          <h4 className="font-poppins font-semibold text-forest text-sm">
            Alertes pour tes plantes
          </h4>
        </div>

        {plantAlerts.length === 0 ? (
          <div className="flex items-center gap-3 rounded-xl bg-lime/10 border border-lime/30 p-3">
            <CheckCircle size={16} aria-hidden className="text-lime shrink-0" />
            <p className="font-raleway text-sm text-forest">
              Tes plantes sont bien préparées pour la météo de la semaine 🌱
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {plantAlerts.map((alert, i) => (
              <AlertItem key={`${alert.plantId}-${alert.alertType}-${i}`} alert={alert} />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}
