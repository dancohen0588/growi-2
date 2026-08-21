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

/**
 * Échéance d'une tâche, dite comme on la dirait : « en retard », « demain »,
 * « lundi 25 août ». Le retard est signalé pour que l'écran puisse le teinter.
 */
export function formatDueDate(
  dueIso: string,
  now = new Date(),
): { label: string; late: boolean } {
  const today = startOfDay(now)
  const due = new Date(`${dueIso}T00:00:00`)
  const days = Math.round((due.getTime() - today.getTime()) / 86_400_000)

  if (days < 0) return { label: days === -1 ? "en retard d'un jour" : `en retard de ${-days} jours`, late: true }
  if (days === 0) return { label: "aujourd'hui", late: false }
  if (days === 1) return { label: 'demain', late: false }
  if (days < 7) return { label: `${WEEKDAYS[due.getDay()]} ${due.getDate()}`, late: false }

  return { label: formatDayLabel(due), late: false }
}

/** Jour abrégé d'une date `YYYY-MM-DD` — « mar. 25 », pour la prévision. */
export function shortDayLabel(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`)
  return `${WEEKDAYS[date.getDay()].slice(0, 3)}. ${date.getDate()}`
}

/** Salutation selon l'heure, pour ouvrir l'écran d'accueil sur un ton humain. */
export function greeting(date = new Date()): string {
  const hour = date.getHours()
  if (hour < 6) return 'Bonne nuit'
  if (hour < 18) return 'Bonjour'
  return 'Bonsoir'
}
