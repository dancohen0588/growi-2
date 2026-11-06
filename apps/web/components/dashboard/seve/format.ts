/**
 * « aujourd'hui », « hier », « il y a 3 jours », puis la date — comme
 * `formatLogDate` côté mobile.
 *
 * Le rendu se fait sur le serveur, en UTC : les jours sont comparés dans le
 * fuseau de Paris, celui de presque tous les comptes, plutôt que de faire
 * basculer « hier » à 1 h du matin.
 */
const DAY = new Intl.DateTimeFormat('fr-CA', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit' })
const LONG = new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', day: 'numeric', month: 'long' })

function dayNumber(date: Date): number {
  return Date.parse(`${DAY.format(date)}T00:00:00Z`) / 86_400_000
}

export function formatSapDay(iso: string, now: Date = new Date()): string {
  const date = new Date(iso)
  const days = Math.round(dayNumber(now) - dayNumber(date))
  if (days <= 0) return 'aujourd’hui'
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} jours`
  return LONG.format(date)
}
