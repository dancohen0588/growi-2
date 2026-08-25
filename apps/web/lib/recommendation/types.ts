import type { PlantInstance, PlantCatalog, GardenZone, Garden } from '@prisma/client'
import type { ActionType, ActionPriority } from '@/lib/mock-actions'

// ─── Weather ───────────────────────────────────────────────────────────────

export interface WeatherForecast {
  latitude: number
  longitude: number
  timezone: string
  current: {
    temperature: number
    precipitation: number
    weatherCode: number
  }
  daily: Array<{
    date: string                  // "YYYY-MM-DD"
    tempMax: number
    tempMin: number
    precipSum: number
    precipProbabilityMax: number
  }>
}

// ─── Plant context (input for the engine) ──────────────────────────────────

export interface PlantContext {
  instance: PlantInstance & {
    catalogPlant: PlantCatalog | null
    zone: GardenZone | null
  }
  garden: Garden
  weather: WeatherForecast
  currentDate: Date
}

// ─── Actions ───────────────────────────────────────────────────────────────

export interface GardenAction {
  id: string
  type: ActionType
  label: string
  shortLabel: string
  plantId?: string
  plantName?: string
  plantEmoji?: string
  /** Ajoutée par le moteur après évaluation, pas par les règles. */
  plantPhotoUrl?: string | null
  dueDate: string               // ISO date string "YYYY-MM-DD"
  done: boolean
  doneAt?: string
  priority: ActionPriority
  notes?: string
  estimatedMinutes?: number
  recurringDays?: number
  /**
   * D'où vient la tâche. Les règles ne renseignent pas ce champ : une action
   * sans provenance vient du moteur, cas de loin le plus fréquent.
   * Voir `gardenActionSchema` de @growi/shared, que ce type doit refléter.
   */
  source?: 'engine' | 'task'
  /** Renseigné quand `source: 'task'` — sert à acquitter la tâche nommément. */
  taskId?: string
  /**
   * Consigne détaillée, affichée sous le titre de la carte. Les actions du
   * moteur n'en ont pas : leur `label` répète le `shortLabel` avec le nom de la
   * plante, déjà affiché à côté.
   */
  detail?: string
}

// ─── Alerts ────────────────────────────────────────────────────────────────

export interface PlantAlert {
  id: string
  type: 'gel' | 'canicule' | 'secheresse' | 'maladie'
  message: string
  severity: 'high' | 'medium' | 'low'
  plantInstanceId: string
}

// ─── Care tips ─────────────────────────────────────────────────────────────

export interface CareTips {
  watering: string
  light: string
  soil: string
  pruning?: string
  diseases?: string
  winter?: string
}

// ─── Per-plant advice ──────────────────────────────────────────────────────

export interface PlantAdvice {
  plantInstanceId: string
  plantName: string
  plantEmoji: string
  tasks: GardenAction[]
  nextWatering?: Date
  nextPruning?: Date
  harvestWindow?: { start: Date; end: Date }
  alerts: PlantAlert[]
  careTips: CareTips
  generatedAt: Date
}

// ─── Rule interface ────────────────────────────────────────────────────────

export interface AdviceRule {
  id: string
  name: string
  evaluate(ctx: PlantContext): GardenAction[]
  generateAlerts?(ctx: PlantContext): PlantAlert[]
}

// ─── Full garden result ────────────────────────────────────────────────────

export interface GardenAdviceResult {
  gardenId: string
  generatedAt: Date
  expiresAt: Date
  actions: GardenAction[]
  adviceByPlant: PlantAdvice[]
  alerts: PlantAlert[]
}
