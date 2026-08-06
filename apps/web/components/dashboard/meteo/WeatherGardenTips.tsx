// growi-frontend/components/dashboard/meteo/WeatherGardenTips.tsx
'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Leaf, CheckCircle } from 'lucide-react'
import { fadeUp } from '@/lib/animations'
import type { GardenContext, ForecastDay } from '@/types/weather'

interface WeatherGardenTipsProps {
  context: GardenContext | null
  forecast: ForecastDay[]
}

function buildTips(context: GardenContext, forecast: ForecastDay[]): string[] {
  // context already has generalAdvice; we can enrich or just return it
  const tips: string[] = [...context.generalAdvice]

  // Add watering tip if missing
  if (context.wateringIndex.score >= 7 && !tips.some(t => t.toLowerCase().includes('arros'))) {
    tips.push(`${context.wateringIndex.label} — ${context.wateringIndex.reasoning}.`)
  }

  // Frost tips for sensitive plants if not already mentioned
  if (context.frostRisk.level !== 'none' && !tips.some(t => t.toLowerCase().includes('gel'))) {
    tips.push(`${context.frostRisk.label} — protège tes plants fragiles.`)
  }

  // Rain week: no watering needed
  const rainDays = forecast.filter((d) => d.precipitationSum > 5).length
  if (rainDays >= 3 && !tips.some(t => t.toLowerCase().includes('pluv'))) {
    tips.push("Semaine pluvieuse — pas besoin d'arroser. Profites-en pour désherber ou pailler.")
  }

  return tips.slice(0, 4)
}

export function WeatherGardenTips({ context, forecast }: WeatherGardenTipsProps) {
  const shouldReduceMotion = useReducedMotion()

  if (!context) return null

  const tips = buildTips(context, forecast)
  if (tips.length === 0) return null

  return (
    <motion.div
      variants={shouldReduceMotion ? undefined : fadeUp}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
      className="rounded-2xl border border-forest/10 bg-white p-5 shadow-card"
    >
      <div className="flex items-center gap-2 mb-4">
        <Leaf size={18} aria-hidden className="text-forest" />
        <h3 className="font-poppins font-semibold text-forest text-base">Conseils de la semaine</h3>
      </div>

      <ul className="space-y-3">
        {tips.map((tip, i) => (
          <li key={i} className="flex items-start gap-3">
            <CheckCircle size={17} aria-hidden className="text-lime shrink-0 mt-0.5" />
            <p className="font-raleway text-sm text-forest/80 leading-relaxed">{tip}</p>
          </li>
        ))}
      </ul>
    </motion.div>
  )
}
