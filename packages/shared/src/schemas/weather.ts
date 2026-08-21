import { z } from 'zod'

import { forecastDaySchema, weatherCurrentSchema } from './planning'
import { nullish } from './common'

/**
 * Contrat de `GET /api/v1/weather` — la météo du jardin.
 *
 * Reprend ce que la page Météo du web calcule côté navigateur : la prévision
 * à sept jours, le contexte du jardin (zone, saison, gel, arrosage, alertes
 * par plante) et les conseils de la semaine. Le calcul passe côté serveur
 * pour que le mobile en dispose sans le refaire.
 */

// ─── Contexte du jardin ────────────────────────────────────────────────────

export const FROST_LEVELS = ['none', 'low', 'moderate', 'high'] as const
export type FrostLevel = (typeof FROST_LEVELS)[number]

export const frostRiskSchema = z.object({
  level: z.enum(FROST_LEVELS),
  label: z.string(),
  affectedNights: z.number(),
  minTemp: z.number(),
})

export const wateringIndexSchema = z.object({
  /** De 0 (inutile d'arroser) à 10 (urgent). */
  score: z.number(),
  label: z.string(),
  reasoning: z.string(),
})

export const PLANT_WEATHER_ALERT_TYPES = [
  'frost',
  'heat',
  'overwatering',
  'drought',
  'wind',
] as const

export const plantWeatherAlertSchema = z.object({
  plantId: z.string(),
  plantName: z.string(),
  alertType: z.enum(PLANT_WEATHER_ALERT_TYPES),
  severity: z.enum(['info', 'warning', 'critical']),
  message: z.string(),
})

export type PlantWeatherAlert = z.infer<typeof plantWeatherAlertSchema>

export const gardenContextSchema = z.object({
  climateZoneLabel: z.string(),
  gardenSeasonLabel: z.string(),
  elevation: z.number(),
  frostRisk: frostRiskSchema,
  wateringIndex: wateringIndexSchema,
  plantAlerts: z.array(plantWeatherAlertSchema),
  generalAdvice: z.array(z.string()),
})

export type GardenContext = z.infer<typeof gardenContextSchema>

// ─── Réponse complète ──────────────────────────────────────────────────────

export const gardenWeatherSchema = z.object({
  locationName: z.string(),
  current: weatherCurrentSchema,
  forecast: z.array(forecastDaySchema),
  /** `null` quand l'utilisateur n'a pas encore de plantes. */
  context: nullish(gardenContextSchema),
  /** Conseils de la semaine, au plus quatre. */
  tips: z.array(z.string()),
})

export type GardenWeather = z.infer<typeof gardenWeatherSchema>

// ─── Conseils de la semaine ────────────────────────────────────────────────

/**
 * Les conseils, déduits du contexte et de la prévision.
 *
 * Repris de la page Météo du web, où ils étaient calculés dans le composant.
 * Les placer ici évite que les deux plateformes n'en donnent des versions
 * différentes.
 */
export function buildWeeklyTips(
  context: GardenContext,
  forecast: Array<{ precipitationSum: number }>,
): string[] {
  const tips = [...context.generalAdvice]

  const mentions = (needle: string) =>
    tips.some((tip) => tip.toLowerCase().includes(needle))

  if (context.wateringIndex.score >= 7 && !mentions('arros')) {
    tips.push(`${context.wateringIndex.label} — ${context.wateringIndex.reasoning}.`)
  }

  if (context.frostRisk.level !== 'none' && !mentions('gel')) {
    tips.push(`${context.frostRisk.label} — protège tes plants fragiles.`)
  }

  const rainyDays = forecast.filter((day) => day.precipitationSum > 5).length
  if (rainyDays >= 3 && !mentions('pluv')) {
    tips.push(
      "Semaine pluvieuse — pas besoin d'arroser. Profites-en pour désherber ou pailler.",
    )
  }

  return tips.slice(0, 4)
}
