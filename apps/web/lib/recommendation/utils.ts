import { toIsoDate, type ActionWindow } from '@growi/shared'

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
