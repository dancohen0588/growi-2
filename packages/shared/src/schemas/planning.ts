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

/** Nom du geste, pour titrer ou étiqueter une action. */
export const ACTION_TYPE_LABELS: Record<ActionType, string> = {
  arrosage: 'Arrosage',
  taille: 'Taille',
  semis: 'Semis',
  rempotage: 'Rempotage',
  fertilisation: 'Fertilisation',
  traitement: 'Traitement',
  recolte: 'Récolte',
  autre: 'À faire',
}

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

/**
 * D'où vient une tâche persistée (`PlantTask.source`).
 *
 * Une tâche n'est jamais créée d'office : elle vient d'une recommandation de
 * diagnostic acceptée, ou d'une proposition du chat confirmée. Savoir laquelle
 * est ce qui permettra un jour de dire à l'utilisateur pourquoi elle est là.
 */
export const TASK_SOURCES = ['DIAGNOSIS', 'CHAT'] as const
export const taskSourceSchema = z.enum(TASK_SOURCES)
export type TaskSource = z.infer<typeof taskSourceSchema>

/**
 * Nature de l'échéance d'une action.
 *
 * `dated` : un jour précis — arroser le basilic aujourd'hui, appliquer le
 * traitement d'un diagnostic mardi. Passé ce jour, l'action est *en retard*.
 * `window` : une période — tailler le rosier « en septembre-octobre ». Une
 * action à fenêtre n'est jamais en retard à l'intérieur de la sienne, et
 * disparaît à sa fermeture. C'est cette distinction qui vide « Aujourd'hui » :
 * la taille, la fertilisation, le rempotage, le traitement et la récolte y
 * ressortaient chaque matin, faute de savoir dire « quelque part ce mois-ci ».
 */
export const ACTION_KINDS = ['dated', 'window'] as const
export const actionKindSchema = z.enum(ACTION_KINDS)
export type ActionKind = z.infer<typeof actionKindSchema>

/** Période d'une action `window`, bornes `YYYY-MM-DD` incluses. */
export const actionWindowSchema = z.object({
  start: z.string(),
  end: z.string(),
})

export type ActionWindow = z.infer<typeof actionWindowSchema>

export const gardenActionSchema = z.object({
  id: z.string(),
  type: actionTypeSchema,
  label: z.string(),
  shortLabel: z.string(),
  plantId: z.string().optional(),
  plantName: z.string().optional(),
  plantEmoji: z.string().optional(),
  /** Photo de la plante — la sienne si elle en a une, sinon celle du catalogue. */
  plantPhotoUrl: nullish(z.string()),
  /** Échéance au format `YYYY-MM-DD`. */
  dueDate: z.string(),
  done: z.boolean(),
  doneAt: z.string().optional(),
  priority: actionPrioritySchema,
  notes: z.string().optional(),
  estimatedMinutes: z.number().optional(),
  recurringDays: z.number().optional(),
  /**
   * D'où vient la tâche : calculée par le moteur de règles, ou figée à
   * l'acceptation d'un diagnostic. Absent vaut `engine` — les actions du
   * moteur, largement majoritaires, n'ont pas à porter le champ.
   */
  source: z.enum(['engine', 'task']).optional(),
  /** Renseigné quand `source: 'task'` : ce que le front renvoie pour l'acquitter. */
  taskId: z.string().optional(),
  /**
   * Consigne détaillée, quand le titre ne suffit pas à agir.
   *
   * Les actions du moteur n'en ont pas : leur `label` ne fait que reprendre le
   * `shortLabel` avec le nom de la plante, déjà affiché à côté. Une
   * recommandation de diagnostic, elle, porte une vraie consigne — dosage,
   * moment de la journée — qu'on ne peut pas résumer sans la perdre.
   */
  detail: z.string().optional(),
  /**
   * Nature de l'échéance. Absent vaut `dated` : les actions produites avant la
   * v2 du planning, et celles qu'un cache périmé sert encore, restent lisibles.
   */
  kind: actionKindSchema.optional(),
  /** Fenêtre d'une action `window`. `dueDate` vaut alors `window.end`. */
  window: actionWindowSchema.optional(),
  /**
   * Pourquoi ce geste, maintenant — une phrase écrite par la règle avec les
   * données de la plante. « Dernier arrosage il y a 4 jours, pour une fréquence
   * de 3 jours. » C'est ce qui manquait au moteur : ses actions n'avaient
   * aucune explication à montrer, et le lien « Voir le détail » ouvrait le vide.
   */
  why: z.string().optional(),
  /** Comment faire — le conseil catalogue du geste (`careTipWatering`, `careTipPruning`…). */
  howTo: z.string().optional(),
  /** Règle d'origine (`r1-watering-standard`), pour le débogage et l'admin. */
  ruleId: z.string().optional(),
  /**
   * Geste écrit au journal quand l'action a été faite aujourd'hui.
   *
   * Renseigné par la liste « Fait aujourd'hui », et par elle seule : c'est ce
   * que « Annuler » a besoin d'effacer. Une action à faire n'en a pas.
   */
  careLogId: z.string().optional(),
})

export type GardenAction = z.infer<typeof gardenActionSchema>

// ─── Échéances ─────────────────────────────────────────────────────────────

/**
 * Les quatre horizons du calendrier, web et mobile.
 *
 * « Demain » n'est plus une section mais une étiquette de *Cette semaine* :
 * elle était presque toujours vide, tandis qu'« Aujourd'hui » débordait de
 * gestes qui pouvaient attendre trois semaines. *Ce mois-ci* recueille les
 * actions à fenêtre, qu'on ne veut ni voir chaque matin ni perdre de vue.
 */
export const ACTION_HORIZONS = ['today', 'week', 'month', 'later'] as const
export type ActionHorizon = (typeof ACTION_HORIZONS)[number]

export const ACTION_HORIZON_LABELS: Record<ActionHorizon, string> = {
  today: "Aujourd'hui",
  week: 'Cette semaine',
  month: 'Ce mois-ci, à ton rythme',
  later: 'Plus tard',
}

/** Jour au format `YYYY-MM-DD`, dans le fuseau local. */
export function toIsoDate(date: Date): string {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10)
}

/** Décale une date `YYYY-MM-DD` de `days` jours. */
export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/** Ce qu'il faut d'une action pour la ranger : son échéance, et sa nature. */
export interface ActionSchedule {
  dueDate: string
  kind?: ActionKind
  window?: ActionWindow
}

/**
 * L'horizon d'une action.
 *
 * Deux natures, deux traitements. Une action **datée** en retard compte pour
 * aujourd'hui : une tâche en souffrance ne doit pas se ranger dans « plus
 * tard », qui la rendrait invisible. Une action **à fenêtre** en cours va dans
 * *Ce mois-ci*, jamais dans *Aujourd'hui* — c'est tout l'objet de la v2.
 *
 * Une fenêtre déjà close est rangée là aussi plutôt que traitée comme un
 * retard : le moteur cesse de la produire à sa fermeture, mais si l'une passe
 * malgré tout, elle n'a aucune raison de virer au rouge.
 */
export function actionHorizon(action: ActionSchedule, today: string): ActionHorizon {
  if (action.kind === 'window' && action.window) {
    return action.window.start > today ? 'later' : 'month'
  }
  if (action.dueDate <= today) return 'today'
  if (action.dueDate <= addDays(today, 7)) return 'week'
  return 'later'
}

/** Range les actions par horizon, dans l'ordre où l'écran les présente. */
export function groupActionsByHorizon<T extends ActionSchedule>(
  actions: T[],
  today: string = toIsoDate(new Date()),
): Record<ActionHorizon, T[]> {
  const groups: Record<ActionHorizon, T[]> = { today: [], week: [], month: [], later: [] }
  for (const action of actions) groups[actionHorizon(action, today)].push(action)
  return groups
}

// ─── Actions groupées ──────────────────────────────────────────────────────

/**
 * Plusieurs actions du même geste, présentées en une seule carte.
 *
 * Rien n'est persisté : le groupe se calcule à l'affichage, des deux côtés,
 * avec la même fonction. Arroser cinq plantes est un geste, pas cinq — cinq
 * cartes à valider une à une, c'est ce qui donnait envie de tout ignorer.
 */
export interface ActionGroup {
  /** `arrosage:today` — stable d'un rendu à l'autre, utilisable comme clé React. */
  key: string
  type: ActionType
  /** Toujours au moins deux : en dessous, l'action reste unitaire. */
  actions: GardenAction[]
}

/**
 * Sépare les actions groupables des autres, à horizon donné.
 *
 * Générique par principe — fertiliser ou traiter une allée entière se fera un
 * jour d'un geste aussi — mais seul l'arrosage est groupé en v1 : c'est le
 * seul qu'on fasse réellement « en tournée ».
 */
export function groupActionsByType(
  actions: GardenAction[],
  types: readonly ActionType[],
  horizon: ActionHorizon,
): { groups: ActionGroup[]; singles: GardenAction[] } {
  const candidates = new Map<ActionType, GardenAction[]>()
  const singles: GardenAction[] = []

  for (const action of actions) {
    // Sans plante, rien à cocher ni à montrer en vignette dans la carte.
    if (!types.includes(action.type) || !action.plantId || action.done) {
      singles.push(action)
      continue
    }
    const bucket = candidates.get(action.type)
    if (bucket) bucket.push(action)
    else candidates.set(action.type, [action])
  }

  const groups: ActionGroup[] = []
  for (const [type, grouped] of candidates) {
    if (grouped.length < 2) singles.push(...grouped)
    else groups.push({ key: `${type}:${horizon}`, type, actions: grouped })
  }

  // L'ordre d'entrée porte le tri du moteur (priorité, puis échéance) ; les
  // actions renvoyées aux unitaires doivent le retrouver.
  singles.sort((a, b) => actions.indexOf(a) - actions.indexOf(b))

  return { groups, singles }
}

/** Les gestes qu'on regroupe en v1. */
export const GROUPED_ACTION_TYPES = ['arrosage'] as const

/** Regroupe les arrosages d'un même horizon en une carte. Voir `groupActionsByType`. */
export function groupWateringActions(
  actions: GardenAction[],
  horizon: ActionHorizon = 'today',
): { groups: ActionGroup[]; singles: GardenAction[] } {
  return groupActionsByType(actions, GROUPED_ACTION_TYPES, horizon)
}

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
  /**
   * L'utilisateur a demandé « Ignorer pour aujourd'hui » sur ce jardin.
   *
   * L'écran l'annonce et propose de rétablir : sans ce drapeau, une liste
   * vidée ne se distinguerait pas d'une journée sans rien à faire, et le geste
   * paraîtrait irréversible.
   */
  clearedToday: z.boolean().optional(),
})

export type GardenPlanning = z.infer<typeof gardenPlanningSchema>

export const todayPlanningSchema = z.object({
  /** Jour de référence, au format `YYYY-MM-DD`. */
  date: z.string(),
  /** Tous les jardins de l'utilisateur, du plus récent au plus ancien. */
  gardens: z.array(gardenPlanningSchema),
  /**
   * Les gestes notés aujourd'hui, chacun avec son `careLogId`.
   *
   * C'est la section « Fait aujourd'hui » et sa seule source : l'accordéon du
   * web se souvenait de ce qu'on venait de cocher, mais l'oubliait au premier
   * rechargement — et son « Annuler » n'effaçait rien.
   */
  doneToday: z.array(gardenActionSchema).optional(),
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
  /** Sert à écrire le geste au journal — requis même pour une tâche. */
  actionType: actionTypeSchema,
  plantId: idSchema.optional(),
  /**
   * Tâche persistée à acquitter, quand l'action en est une.
   *
   * On acquitte par identifiant et non par type de geste : deux tâches
   * « autre » issues de deux diagnostics seraient sinon cochées d'un coup.
   */
  taskId: idSchema.optional(),
})

export type MarkActionDoneInput = z.infer<typeof markActionDoneSchema>

/**
 * Réponse de `POST /api/v1/planning/actions/done`.
 *
 * L'identifiant du geste écrit est rendu pour que « Annuler » ait de quoi
 * mordre : jusqu'ici il n'effaçait rien, et la tâche ne revenait pas. Il est
 * absent quand l'action n'a produit aucun geste — une tâche sans plante.
 */
export const markActionDoneResultSchema = z.object({
  careLogId: nullish(z.string()),
})

export type MarkActionDoneResult = z.infer<typeof markActionDoneResultSchema>

// ─── Cocher plusieurs tâches d'un coup ─────────────────────────────────────

/**
 * Corps de `POST /api/v1/planning/actions/done-bulk`.
 *
 * « J'ai tout arrosé » et « Tout marquer comme fait » passent par là : une
 * requête, une transaction, une seule invalidation du cache de conseils. En
 * enchaînant N appels unitaires on invalidait N fois et l'écran clignotait.
 */
export const markActionsDoneBulkSchema = z.object({
  gardenId: idSchema,
  items: z
    .array(
      z.object({
        actionType: actionTypeSchema,
        plantId: idSchema.optional(),
        taskId: idSchema.optional(),
      }),
    )
    .min(1)
    // Un plafond franc : au-delà, ce n'est plus une tournée de jardin.
    .max(100),
})

export type MarkActionsDoneBulkInput = z.infer<typeof markActionsDoneBulkSchema>

/**
 * Un item en échec — plante supprimée entre-temps — n'annule pas les autres :
 * il est compté dans `skipped` plutôt que de faire échouer la tournée entière.
 */
export const markActionsDoneBulkResultSchema = z.object({
  done: z.number(),
  skipped: z.number(),
  careLogIds: z.array(z.string()),
})

export type MarkActionsDoneBulkResult = z.infer<typeof markActionsDoneBulkResultSchema>

// ─── Faire table rase sans mentir au journal ───────────────────────────────

/**
 * Corps de `POST /api/v1/planning/clear-today`.
 *
 * « Ignorer pour aujourd'hui » masque les actions du moteur jusqu'à demain
 * sans rien inscrire au journal — l'inverse de « Tout marquer comme fait ».
 * `undo` sert au « Rétablir » du bandeau qui suit le geste.
 */
export const clearPlanningTodaySchema = z.object({
  gardenId: idSchema,
  undo: z.boolean().optional(),
})

export type ClearPlanningTodayInput = z.infer<typeof clearPlanningTodaySchema>

// ─── Annuler un geste ──────────────────────────────────────────────────────

/**
 * Corps de `POST /api/v1/planning/actions/undo`.
 *
 * Annuler, c'est effacer le geste du journal, recalculer la date du dernier
 * geste de ce type sur la plante, et rouvrir la tâche s'il y en avait une.
 * Sans quoi la carte revient à l'écran mais la plante reste « arrosée ».
 */
export const undoActionSchema = z.object({
  gardenId: idSchema,
  careLogId: idSchema,
  taskId: idSchema.optional(),
})

export type UndoActionInput = z.infer<typeof undoActionSchema>
