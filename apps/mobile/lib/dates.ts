/**
 * Date d'un geste d'entretien, formulée comme on en parle : « aujourd'hui »,
 * « hier », « il y a 3 jours », puis la date complète au-delà d'une semaine.
 */
export function formatLogDate(iso: string, now = new Date()): string {
  const date = new Date(iso)
  const days = Math.floor(
    (startOfDay(now).getTime() - startOfDay(date).getTime()) / 86_400_000,
  )

  if (days <= 0) return "aujourd'hui"
  if (days === 1) return 'hier'
  if (days < 7) return `il y a ${days} jours`

  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

const WEEKDAYS = [
  'dimanche',
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
] as const

const MONTHS = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
] as const

/**
 * Jour en toutes lettres — « jeudi 21 août ».
 *
 * Écrit à la main plutôt qu'avec `Intl` : Hermes n'embarque pas les données de
 * locale sur toutes les plateformes, et l'app n'est qu'en français.
 */
export function formatDayLabel(date = new Date()): string {
  const day = date.getDate()
  return `${WEEKDAYS[date.getDay()]} ${day === 1 ? '1er' : day} ${MONTHS[date.getMonth()]}`
}

/** Salutation selon l'heure, pour ouvrir l'écran d'accueil sur un ton humain. */
export function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 6) return 'Bonne nuit'
  if (hour < 18) return 'Bonjour'
  return 'Bonsoir'
}
