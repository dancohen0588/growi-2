// growi-frontend/lib/calendar-utils.ts
import { GardenAction, ActionType } from './mock-actions'

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
/**
 * Échéance dite comme on la dirait : « en retard de 2 jours », « demain »,
 * « lundi 25 ». Le retard est signalé à part pour que la carte le teinte.
 *
 * L'app mobile a la même fonction (`lib/dates.ts`) : les deux écrans doivent
 * formuler une échéance de la même façon.
 */
export function formatDueDate(
  isoDate: string,
  now = new Date(),
): { label: string; late: boolean } {
  const today = new Date(now)
  today.setHours(0, 0, 0, 0)
  const due = new Date(`${isoDate}T00:00:00`)
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)

  if (days < 0) {
    return {
      label: days === -1 ? "en retard d'un jour" : `en retard de ${-days} jours`,
      late: true,
    }
  }
  if (days === 0) return { label: "aujourd'hui", late: false }
  if (days === 1) return { label: 'demain', late: false }
  if (days < 7) return { label: formatShortDate(isoDate), late: false }

  return { label: formatMediumDate(isoDate), late: false }
}

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
