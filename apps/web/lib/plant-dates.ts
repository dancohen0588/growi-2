/**
 * Dates du journal d'entretien, en toutes lettres.
 *
 * Le mobile a son propre `lib/dates.ts` parce que Hermes n'embarque pas les
 * données de locale ; le web pourrait utiliser `Intl`, mais les deux fiches
 * doivent se lire pareil — « il y a 3 jours » d'un côté et « 22/08/2026 » de
 * l'autre pour la même plante serait déroutant.
 */

const DAY = 86_400_000

/** « Aujourd'hui », « hier », « il y a 6 jours », puis la date. */
export function formatLogDate(iso?: string | null, now: Date = new Date()): string {
  if (!iso) return 'Jamais'

  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Jamais'

  // On compare des jours civils, pas des instants : un arrosage d'hier soir
  // reste « hier » quelle que soit l'heure qu'il est.
  const days = Math.round(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / DAY,
  )

  if (days <= 0) return "Aujourd'hui"
  if (days === 1) return 'Hier'
  if (days < 30) return `Il y a ${days} jours`

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}
