import { toIsoDate, type ActionWindow } from '@growi/shared'

import type { PlantContext, WeatherForecast } from './types'

const MS_PER_DAY = 86_400_000

/**
 * Jour civil `YYYY-MM-DD`, dans le fuseau du serveur.
 *
 * Les règles écrivaient `date.toISOString().slice(0, 10)`, qui donne la veille
 * entre minuit et 2 h à Paris, et le mois précédent pour un premier du mois
 * construit en heure locale. Le partagé sait déjà le faire correctement.
 */
export const isoDay = toIsoDate

/** Premier jour du mois, `YYYY-MM-DD`. `month` de 1 à 12. */
export function startOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}-01`
}

/** Dernier jour du mois, `YYYY-MM-DD`. `month` de 1 à 12. */
export function endOfMonth(year: number, month: number): string {
  const days = new Date(year, month, 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${String(days).padStart(2, '0')}`
}

/**
 * La fenêtre ouverte par le mois courant, jusqu'à la fin de la dernière série
 * de mois consécutifs de `months`.
 *
 * Un rosier qui se taille en mars-avril donne « du 1ᵉʳ mars au 30 avril » : une
 * seule action pour la période, là où l'échéance au 1ᵉʳ du mois faisait afficher
 * « en retard » en rouge dès le 2. Les listes qui passent d'une année à l'autre
 * (novembre-décembre-janvier) sont suivies au-delà du 31 décembre.
 */
export function monthRunWindow(months: number[], date: Date): ActionWindow {
  const startMonth = date.getMonth() + 1
  const startYear = date.getFullYear()

  let month = startMonth
  let year = startYear
  // Douze pas au plus : une liste de mois ne peut pas être plus longue que
  // l'année, et une liste absurde ne doit pas faire tourner la boucle sans fin.
  for (let step = 0; step < 12; step += 1) {
    const next = month === 12 ? 1 : month + 1
    if (!months.includes(next)) break
    if (next === 1) year += 1
    month = next
  }

  return { start: startOfMonth(startYear, startMonth), end: endOfMonth(year, month) }
}

/**
 * La fenêtre de la saison en cours.
 *
 * L'hiver enjambe le 31 décembre : en janvier, la fenêtre a commencé au
 * 1ᵉʳ décembre de l'année précédente — une saison n'est pas un mois.
 */
export function seasonWindow(date: Date): ActionWindow {
  const month = date.getMonth() + 1
  const year = date.getFullYear()

  if (month >= 3 && month <= 5) return { start: startOfMonth(year, 3), end: endOfMonth(year, 5) }
  if (month >= 6 && month <= 8) return { start: startOfMonth(year, 6), end: endOfMonth(year, 8) }
  if (month >= 9 && month <= 11) return { start: startOfMonth(year, 9), end: endOfMonth(year, 11) }

  const winterStartYear = month === 12 ? year : year - 1
  return { start: startOfMonth(winterStartYear, 12), end: endOfMonth(winterStartYear + 1, 2) }
}

/** Date en toutes lettres pour une phrase d'explication : « 14 octobre 2025 ». */
export function frenchDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function parseJsonArray(value: string | null | undefined): number[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function parseMonthsCsv(value: string | null | undefined): number[] {
  if (!value) return []
  // Handle JSON array format
  if (value.trim().startsWith('[')) return parseJsonArray(value)
  // Handle CSV format "1,3,5"
  return value
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n))
}

export function getCurrentSeason(month: number): 'SPRING' | 'SUMMER' | 'AUTUMN' | 'WINTER' {
  if (month >= 3 && month <= 5) return 'SPRING'
  if (month >= 6 && month <= 8) return 'SUMMER'
  if (month >= 9 && month <= 11) return 'AUTUMN'
  return 'WINTER'
}

export function daysSince(date: Date | null | undefined, now: Date = new Date()): number {
  if (!date) return Infinity
  return (now.getTime() - new Date(date).getTime()) / MS_PER_DAY
}

export function isMonthIn(month: number, jsonArray: string | null | undefined): boolean {
  return parseJsonArray(jsonArray).includes(month)
}

/**
 * Dernière fois que l'action de `ruleId` a été cochée pour la plante, ou
 * `null`. Voir `PlantContext.ruleLogs`.
 */
export function lastDoneByRule(ctx: PlantContext, ruleId: string): Date | null {
  return ctx.ruleLogs?.[ruleId] ?? null
}

/**
 * L'action de `ruleId` a-t-elle été cochée depuis `since` (une date, ou un
 * jour `YYYY-MM-DD` compris comme son début) ?
 *
 * Pour une action à fenêtre, `since` est le début de la fenêtre : pailler en
 * octobre vaut pour tout l'automne, pas pour le seul jour du geste.
 */
export function doneSince(ctx: PlantContext, ruleId: string, since: Date | string): boolean {
  const last = lastDoneByRule(ctx, ruleId)
  if (!last) return false
  const from = typeof since === 'string' ? new Date(`${since}T00:00:00`) : since
  return last.getTime() >= from.getTime()
}

/**
 * Une plante qui prend la pluie, le vent et le gel : en pleine terre ou au
 * balcon. Une serre ou un intérieur en est à l'abri.
 */
export function isExposed(location: string | null | undefined): boolean {
  return location === 'OUTDOOR' || location === 'BALCONY'
}

/**
 * Les jours de prévision qui restent au-dessus de `minC` la nuit, parmi les
 * `days` prochains. Faux si la prévision est trop courte pour en juger.
 */
export function nightsAbove(weather: WeatherForecast, minC: number, days: number): boolean {
  const next = weather.daily.slice(0, days)
  return next.length >= days && next.every((d) => d.tempMin > minC)
}

/**
 * Mois où une plante en pleine terre se contente de la pluie, en région
 * parisienne : de novembre à février. Le moteur proposait de les arroser comme
 * en été — 51 plantes sur 55 « à arroser aujourd'hui » un 5 novembre, faute
 * d'arrosage noté depuis des semaines.
 */
export const WINTER_REST_MONTHS = [11, 12, 1, 2]

/**
 * Une annuelle gélive restée dehors après l'été : tomate, courgette, basilic
 * de novembre à mars. Le premier gel l'a emportée ; il n'y a plus rien à
 * arroser, pailler ni protéger, seulement à arracher (r17).
 */
export function isFinishedAnnual(ctx: PlantContext): boolean {
  const { instance, currentDate } = ctx
  const catalog = instance.catalogPlant
  if (!catalog) return false
  if (catalog.category !== 'VEGETABLE' && catalog.category !== 'HERBS') return false
  if (catalog.frostSensitivity !== 'HIGH') return false
  if (!isExposed(instance.location)) return false
  return [11, 12, 1, 2, 3].includes(currentDate.getMonth() + 1)
}

/** Minimum prévu sur les `days` prochains jours, ou `null` sans prévision. */
export function minTempWithin(weather: WeatherForecast, days: number): number | null {
  const next = weather.daily.slice(0, days)
  if (next.length === 0) return null
  return Math.min(...next.map((d) => d.tempMin))
}
