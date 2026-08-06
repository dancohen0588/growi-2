// growi-frontend/lib/calendar-utils.ts
import { GardenAction, ActionType } from './mock-actions'

export type TemporalBucket =
  | 'today'
  | 'tomorrow'
  | 'this-week'
  | 'this-month'
  | 'later'

/**
 * Returns the temporal bucket for a given ISO date string, relative to today.
 * today      = 0 days difference
 * tomorrow   = 1 day
 * this-week  = 2–7 days
 * this-month = 8–30 days
 * later      = > 30 days
 */
export function getTemporalBucket(dueDate: string): TemporalBucket {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diffMs = due.getTime() - today.getTime()
  const diffDays = Math.round(diffMs / 86400000)

  if (diffDays === 0) return 'today'
  if (diffDays === 1) return 'tomorrow'
  if (diffDays <= 7) return 'this-week'
  if (diffDays <= 30) return 'this-month'
  return 'later'
}

/** Group actions by their ActionType */
export function groupByType(
  actions: GardenAction[],
): Partial<Record<ActionType, GardenAction[]>> {
  return actions.reduce<Partial<Record<ActionType, GardenAction[]>>>(
    (acc, action) => {
      const key = action.type
      if (!acc[key]) acc[key] = []
      acc[key]!.push(action)
      return acc
    },
    {},
  )
}

/** Group actions by month label "Avril 2026", "Mai 2026", etc. */
export function groupByMonth(
  actions: GardenAction[],
): { monthLabel: string; actions: GardenAction[] }[] {
  const map = new Map<string, GardenAction[]>()
  for (const a of actions) {
    const label = new Date(a.dueDate).toLocaleDateString('fr-FR', {
      month: 'long',
      year: 'numeric',
    })
    const capitalized = label.charAt(0).toUpperCase() + label.slice(1)
    if (!map.has(capitalized)) map.set(capitalized, [])
    map.get(capitalized)!.push(a)
  }
  return Array.from(map.entries()).map(([monthLabel, actions]) => ({
    monthLabel,
    actions,
  }))
}

/** "Jeu 10" style short date */
export function formatShortDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
  })
}

/** "7 avril" style medium date */
export function formatMediumDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
  })
}

/** Label for priority badge */
export const priorityLabel: Record<'high' | 'medium' | 'low', string> = {
  high:   'Urgent',
  medium: 'Normal',
  low:    'Basse priorité',
}

/** Tailwind border-left colour per priority (for ActionCardLarge) */
export const priorityBorderColor: Record<'high' | 'medium' | 'low', string> = {
  high:   'border-l-red-400',
  medium: 'border-l-sun',
  low:    'border-l-forest/30',
}

/** Badge bg+text colour per priority */
export const priorityBadgeColor: Record<'high' | 'medium' | 'low', string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-sun/20 text-forest',
  low:    'bg-forest/10 text-forest/70',
}
