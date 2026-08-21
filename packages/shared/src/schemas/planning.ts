import { z } from 'zod'

import { type CareLogType } from '../constants/enums'
import { idSchema, nullish } from './common'

/**
 * Contrat de `GET /api/v1/planning/today` — l'écran d'accueil du mobile.
 *
 * Les tâches et alertes sont produites par le moteur de recommandation du
 * web ; ces schémas en figent la forme telle qu'elle transite sur le réseau.
 */

// ─── Tâches ────────────────────────────────────────────────────────────────

export const ACTION_TYPES = [
  'arrosage',
  'taille',
  'semis',
  'rempotage',
  'fertilisation',
  'traitement',
  'recolte',
  'autre',
] as const
export const actionTypeSchema = z.enum(ACTION_TYPES)
export type ActionType = z.infer<typeof actionTypeSchema>

/**
 * Geste du journal qui accomplit chaque tâche du planning.
 *
 * C'est le pont entre le vocabulaire du moteur de recommandation (français,
 * orienté tâche) et celui du journal d'entretien (anglais, orienté geste).
 * Cocher « fait » enregistre le geste correspondant, et le planning s'appuie
 * sur ce même geste pour ne plus proposer la tâche.
 */
export const CARE_LOG_TYPE_BY_ACTION: Record<ActionType, CareLogType> = {
  arrosage: 'watering',
  taille: 'pruning',
  semis: 'sowing',
  rempotage: 'repotting',
  fertilisation: 'fertilizing',
  traitement: 'treatment',
  recolte: 'harvest',
  autre: 'other',
}

export const ACTION_PRIORITIES = ['high', 'medium', 'low'] as const
export const actionPrioritySchema = z.enum(ACTION_PRIORITIES)
export type ActionPriority = z.infer<typeof actionPrioritySchema>

export const gardenActionSchema = z.object({
  id: z.string(),
  type: actionTypeSchema,
  label: z.string(),
  shortLabel: z.string(),
  plantId: z.string().optional(),
  plantName: z.string().optional(),
  plantEmoji: z.string().optional(),
  /** Échéance au format `YYYY-MM-DD`. */
  dueDate: z.string(),
  done: z.boolean(),
  doneAt: z.string().optional(),
  priority: actionPrioritySchema,
  notes: z.string().optional(),
  estimatedMinutes: z.number().optional(),
  recurringDays: z.number().optional(),
})

export type GardenAction = z.infer<typeof gardenActionSchema>

// ─── Alertes ───────────────────────────────────────────────────────────────

export const ALERT_TYPES = ['gel', 'canicule', 'secheresse', 'maladie'] as const
export const alertTypeSchema = z.enum(ALERT_TYPES)
export type AlertType = z.infer<typeof alertTypeSchema>

export const ALERT_SEVERITIES = ['high', 'medium', 'low'] as const
export const alertSeveritySchema = z.enum(ALERT_SEVERITIES)
export type AlertSeverity = z.infer<typeof alertSeveritySchema>

export const plantAlertSchema = z.object({
  id: z.string(),
  type: alertTypeSchema,
  message: z.string(),
  severity: alertSeveritySchema,
  plantInstanceId: z.string(),
})

export type PlantAlert = z.infer<typeof plantAlertSchema>

// ─── Météo embarquée dans le planning ──────────────────────────────────────

export const weatherCurrentSchema = z.object({
  temperature: z.number(),
  apparentTemperature: z.number(),
  humidity: z.number(),
  precipitation: z.number(),
  weatherCode: z.number(),
  windSpeed: z.number(),
  windDirection: z.number(),
  time: z.string(),
})

export type WeatherCurrent = z.infer<typeof weatherCurrentSchema>

export const forecastDaySchema = z.object({
  /** Jour au format `YYYY-MM-DD`. */
  date: z.string(),
  weatherCode: z.number(),
  tempMax: z.number(),
  tempMin: z.number(),
  precipitationSum: z.number(),
  precipitationProbability: z.number(),
  sunrise: z.string(),
  sunset: z.string(),
})

export type ForecastDay = z.infer<typeof forecastDaySchema>

export const planningWeatherSchema = z.object({
  locationName: z.string(),
  current: weatherCurrentSchema,
  today: nullish(forecastDaySchema),
})

export type PlanningWeather = z.infer<typeof planningWeatherSchema>

// ─── Réponse complète ──────────────────────────────────────────────────────

/**
 * Le planning d'un jardin.
 *
 * L'utilisateur peut en avoir plusieurs ; l'écran d'accueil les présente donc
 * en sections plutôt que de n'en retenir qu'un et de taire le travail des
 * autres.
 */
export const gardenPlanningSchema = z.object({
  id: idSchema,
  name: z.string(),
  /** Tâches dues aujourd'hui ou en retard, non encore faites. */
  actions: z.array(gardenActionSchema),
  alerts: z.array(plantAlertSchema),
})

export type GardenPlanning = z.infer<typeof gardenPlanningSchema>

export const todayPlanningSchema = z.object({
  /** Jour de référence, au format `YYYY-MM-DD`. */
  date: z.string(),
  /** Tous les jardins de l'utilisateur, du plus récent au plus ancien. */
  gardens: z.array(gardenPlanningSchema),
  /** `null` si l'utilisateur n'a pas de coordonnées ou si la météo est indisponible. */
  weather: nullish(planningWeatherSchema),
})

export type TodayPlanning = z.infer<typeof todayPlanningSchema>

// ─── Cocher une tâche ──────────────────────────────────────────────────────

/**
 * Corps de `POST /api/v1/planning/actions/done`.
 *
 * La tâche est identifiée par ce qu'elle produit — un geste sur une plante —
 * et non par son identifiant, que le moteur recalcule à chaque évaluation.
 */
export const markActionDoneSchema = z.object({
  gardenId: idSchema,
  actionType: actionTypeSchema,
  plantId: idSchema.optional(),
})

export type MarkActionDoneInput = z.infer<typeof markActionDoneSchema>
