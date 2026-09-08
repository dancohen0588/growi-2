/**
 * Le jour civil d'un utilisateur, dans **son** fuseau.
 *
 * Compter en UTC ferait basculer sa journée à 2 h du matin l'été en France —
 * au milieu de sa soirée, pas au bout de sa journée. Le quota du chat le
 * faisait déjà ; le planning en a besoin à son tour pour « Ignorer pour
 * aujourd'hui », d'où l'extraction de ces trois fonctions hors de
 * `chat.service`. Les recopier aurait fait diverger deux définitions de
 * « aujourd'hui » dans la même application.
 */

/** Un fuseau que `Intl` refuse ne doit jamais faire échouer une requête. */
export function safeTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return timeZone
  } catch {
    console.error('[zoned-day] fuseau inconnu, repli sur Europe/Paris :', timeZone)
    return 'Europe/Paris'
  }
}

/** Décalage du fuseau à cet instant, en millisecondes à l'est de UTC. */
export function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  )
  return asUtc - (date.getTime() - date.getMilliseconds())
}

/** Minuit du jour en cours dans ce fuseau, en instant absolu. */
export function startOfZonedDay(date: Date, timeZone: string): Date {
  const offset = zoneOffsetMs(date, timeZone)
  const local = new Date(date.getTime() + offset)
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  return new Date(midnight - offset)
}

/**
 * Le jour `YYYY-MM-DD` de l'utilisateur.
 *
 * C'est la valeur écrite dans `Garden.planningClearedOn` et celle à laquelle
 * les horizons du planning se comparent : « ignorer pour aujourd'hui » à
 * 23 h 30 à Paris ne doit pas être levé à 2 h du matin.
 */
export function zonedDayIso(date: Date, timeZone: string): string {
  const zone = safeTimeZone(timeZone)
  const local = new Date(date.getTime() + zoneOffsetMs(date, zone))
  return local.toISOString().slice(0, 10)
}
