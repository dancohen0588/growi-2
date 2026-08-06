// growi-frontend/components/dashboard/meteo/WeatherForecastRow.tsx
'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Droplets } from 'lucide-react'
import { getWeatherInfo } from '@/lib/weather-codes'
import { staggerContainer } from '@/lib/animations'
import type { ForecastDay } from '@/types/weather'
import { cn } from '@/lib/utils'

interface WeatherForecastRowProps {
  forecast: ForecastDay[]
}

const FR_DAYS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']
const FR_MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']

function formatDayLabel(dateStr: string, isToday: boolean): string {
  if (isToday) return "Auj."
  const d = new Date(dateStr + 'T12:00:00')
  return `${FR_DAYS[d.getDay()]} ${d.getDate()}`
}

function formatMonth(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  return FR_MONTHS[d.getMonth()]
}

export function WeatherForecastRow({ forecast }: WeatherForecastRowProps) {
  const shouldReduceMotion = useReducedMotion()
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="rounded-2xl border border-forest/10 bg-white p-5 shadow-card">
      <h3 className="font-poppins font-semibold text-forest text-base mb-4">
        Prévisions 7 jours
      </h3>

      <motion.div
        variants={shouldReduceMotion ? undefined : staggerContainer}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true }}
        className="flex gap-3 overflow-x-auto pb-1"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#B4DD7F transparent' }}
        role="list"
        aria-label="Prévisions météo sur 7 jours"
      >
        {forecast.map((day, i) => {
          const info = getWeatherInfo(day.weatherCode)
          const WeatherIcon = info.icon
          const isToday = day.date === today

          return (
            <motion.div
              key={day.date}
              variants={shouldReduceMotion ? undefined : {
                hidden: { opacity: 0, y: 16 },
                visible: {
                  opacity: 1,
                  y: 0,
                  transition: { duration: 0.4, delay: i * 0.06, ease: 'easeOut' },
                },
              }}
              role="listitem"
              aria-label={`${formatDayLabel(day.date, isToday)} : ${info.label}, ${Math.round(day.tempMax)}° / ${Math.round(day.tempMin)}°`}
              className={cn(
                'min-w-[90px] rounded-xl p-3 text-center shrink-0 transition-shadow hover:shadow-card-hover',
                isToday
                  ? 'border-2 border-lime bg-lime/10'
                  : 'border border-forest/10 bg-sand',
              )}
            >
              {/* Day label */}
              <div className="font-poppins font-semibold text-forest text-xs mb-0.5">
                {formatDayLabel(day.date, isToday)}
              </div>
              <div className="font-raleway text-forest/40 text-[10px] mb-2">
                {formatMonth(day.date)}
              </div>

              {/* Weather icon */}
              <div className="flex justify-center mb-2">
                <WeatherIcon
                  size={28}
                  aria-hidden
                  className="text-forest"
                  strokeWidth={1.5}
                />
              </div>

              {/* Temperature range */}
              <div className="font-poppins text-forest text-sm font-semibold">
                {Math.round(day.tempMax)}°
              </div>
              <div className="font-raleway text-forest/50 text-xs">
                {Math.round(day.tempMin)}°
              </div>

              {/* Precipitation probability */}
              {day.precipitationProbability > 10 && (
                <div className="flex items-center justify-center gap-1 mt-1.5">
                  <Droplets size={11} aria-hidden className="text-forest/40" />
                  <span className="font-raleway text-[10px] text-forest/50">
                    {day.precipitationProbability}%
                  </span>
                </div>
              )}
            </motion.div>
          )
        })}
      </motion.div>
    </div>
  )
}
