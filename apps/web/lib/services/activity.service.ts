/**
 * Trace d'activité des comptes.
 *
 * La base ne savait pas quand un utilisateur s'était connecté pour la dernière
 * fois : les `RefreshToken` sont un proxy partiel du mobile, et le web, qui
 * s'authentifie par cookie, ne laissait rien du tout. Cette instrumentation est
 * la **seule** source des indicateurs d'actifs (DAU/WAU/MAU) du portail
 * d'administration — d'où son arrivée avant les écrans qui la consommeront :
 * plus tôt elle tourne, plus tôt les courbes ont de l'histoire.
 *
 * Trois règles tiennent tout le fichier :
 *
 * 1. **Rien ne lève.** Une trace manquée est une ligne d'histogramme en moins,
 *    jamais une requête cassée. `touchActivity` avale ses erreurs.
 * 2. **Rien n'est attendu.** L'écriture part hors du chemin critique (`after()`
 *    n'existe pas en Next 14) : on lance la promesse sans `await`.
 * 3. **Au plus une écriture par heure et par utilisateur**, grâce à un cache
 *    mémoire par process. Sur Vercel chaque instance a le sien, donc au pire
 *    quelques écritures redondantes par heure — l'`upsert` les absorbe.
 */

import type { ActivitySurface } from '@growi/shared'

import { prisma } from '@/lib/prisma'

/** Intervalle minimal entre deux écritures pour un même utilisateur. */
export const TOUCH_INTERVAL_MS = 60 * 60 * 1000

/**
 * Dernière écriture connue, par utilisateur. Propre au process : c'est un
 * étranglement, pas un verrou — il n'a pas besoin d'être exact.
 */
const lastTouch = new Map<string, number>()

/**
 * Au-delà, on élague les entrées périmées. Une entrée plus vieille que
 * l'intervalle n'étrangle plus rien : la garder ne ferait que faire enfler la
 * mémoire d'une instance de longue vie, un utilisateur à la fois.
 */
const THROTTLE_MAX_ENTRIES = 10_000

function pruneThrottle(now: number): void {
  if (lastTouch.size < THROTTLE_MAX_ENTRIES) return
  for (const [userId, at] of lastTouch) {
    if (now - at >= TOUCH_INTERVAL_MS) lastTouch.delete(userId)
  }
}

/** Jour UTC au format `YYYY-MM-DD`, même convention que `IdentifyQuota`. */
export function activityDay(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10)
}

/**
 * Écrit la trace, sans passer par l'étranglement. Exporté pour les tests et
 * pour un éventuel appel depuis une tâche planifiée.
 */
export async function recordActivity(
  userId: string,
  surface: ActivitySurface,
  at: Date = new Date(),
): Promise<void> {
  const day = activityDay(at)

  await prisma.$transaction([
    // La ligne du jour peut déjà exister : c'est le cas nominal dès la seconde
    // heure d'utilisation. `upsert` sans champ à mettre à jour = ON CONFLICT
    // DO NOTHING, la table n'a que sa clé primaire.
    prisma.userActivity.upsert({
      where: { userId_day_surface: { userId, day, surface } },
      create: { userId, day, surface },
      update: {},
    }),
    prisma.user.update({ where: { id: userId }, data: { lastSeenAt: at } }),
  ])
}

/**
 * Note que l'utilisateur est actif, si la dernière trace date de plus d'une
 * heure.
 *
 * **Ne lève jamais et ne bloque pas** : l'appelant n'a pas à l'attendre ni à
 * l'entourer d'un `try`. Renvoie `true` si une écriture a été lancée, ce qui
 * rend l'étranglement testable sans horloge.
 */
export function touchActivity(
  userId: string,
  surface: ActivitySurface,
  now: number = Date.now(),
): boolean {
  const previous = lastTouch.get(userId)
  if (previous !== undefined && now - previous < TOUCH_INTERVAL_MS) return false

  pruneThrottle(now)

  // Posé **avant** l'écriture : deux requêtes concurrentes du même utilisateur
  // ne doivent pas déclencher deux transactions. Un échec ne le remet pas à
  // zéro — on retentera à la prochaine heure, ce qui est le bon compromis.
  lastTouch.set(userId, now)

  void recordActivity(userId, surface, new Date(now)).catch((err) => {
    console.error('[activity] écriture de la trace impossible', err)
  })

  return true
}

/** Remet l'étranglement à zéro. Réservé aux tests. */
export function resetActivityThrottle(): void {
  lastTouch.clear()
}
