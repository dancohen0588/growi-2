import type { PlantInstance, PlantCatalog, GardenZone, Garden } from '@prisma/client'
import type { ActionKind, ActionWindow } from '@growi/shared'
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
  /**
   * Pluie tombée sur les trois derniers jours, en mm.
   *
   * Absente quand la météo est neutre ou que l'API ne l'a pas rendue : une
   * règle qui la lit doit tenir l'absence pour « on ne sait pas », pas pour
   * « il n'a pas plu ».
   */
  recentPrecipSum?: number
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
  /**
   * Dernière fois que l'action de chaque règle a été cochée pour cette
   * plante, lue dans le journal (`CareLog.ruleId`).
   *
   * C'est ce qui ferme les règles qu'aucune date `last*At` ne clôt —
   * paillage, hivernage, fleurs fanées, semis. Absent, ces règles parlent
   * comme si rien n'avait été fait, ce qui reste juste pour une plante neuve.
   */
  ruleLogs?: Record<string, Date>
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
  /**
   * Nature de l'échéance. Absent vaut `dated` — une règle qui ne se prononce
   * pas produit une action au jour près, comme avant la v2 du planning.
   */
  kind?: ActionKind
  /** Période d'une action `window` ; `dueDate` vaut alors `window.end`. */
  window?: ActionWindow
  /** Pourquoi ce geste maintenant, écrit par la règle avec les données de la plante. */
  why?: string
  /** Comment faire — le conseil catalogue correspondant au geste. */
  howTo?: string
  /** Règle d'origine (`r1-watering-standard`), pour le débogage et l'admin. */
  ruleId?: string
  /** Geste écrit au journal — renseigné par la liste « Fait aujourd'hui ». */
  careLogId?: string
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
  /**
   * Nom du geste écrit au journal quand l'action est cochée, pour les règles
   * qui produisent une action « autre » : sans lui, le journal n'afficherait
   * qu'« Autre geste ».
   */
  gestureLabel?: string
  evaluate(ctx: PlantContext): GardenAction[]
  generateAlerts?(ctx: PlantContext): PlantAlert[]
}

// ─── Full garden result ────────────────────────────────────────────────────

export interface GardenAdviceResult {
  /**
   * Forme du payload — voir `ADVICE_PAYLOAD_VERSION`. Absente sur les résultats
   * mis en cache avant la v2 du planning : c'est ce qui permet de les écarter.
   */
  version?: number
  gardenId: string
  generatedAt: Date
  expiresAt: Date
  actions: GardenAction[]
  adviceByPlant: PlantAdvice[]
  alerts: PlantAlert[]
}
