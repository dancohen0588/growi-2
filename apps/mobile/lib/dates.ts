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
