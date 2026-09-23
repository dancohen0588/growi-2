/**
 * Effacement d'une personne dans PostHog, à la suppression de son compte.
 *
 * Le SDK serveur ne sait qu'émettre : l'effacement passe par l'API de gestion,
 * avec une clé **personnelle** (`POSTHOG_PERSONAL_API_KEY`, portée
 * `person:write`), distincte de la clé de projet qui, elle, est publique.
 *
 * Deux appels : retrouver la personne par son `distinct_id` (l'identifiant du
 * compte), puis la supprimer **avec ses événements**. Sans le second
 * paramètre, PostHog efface le profil et garde l'historique — ce que la
 * politique ne promet pas.
 *
 * **Ne lève jamais.** Le compte est déjà supprimé quand on arrive ici ; un
 * échec est remonté à Sentry avec l'identifiant pour être rattrapé à la main,
 * jamais à l'utilisateur.
 */

import * as Sentry from '@sentry/nextjs'

const API_HOST = 'https://eu.posthog.com'
const TIMEOUT_MS = 5_000

type Outcome = 'deleted' | 'not_found' | 'skipped' | 'failed'

export async function deletePostHogPerson(userId: string): Promise<Outcome> {
  const key = process.env.POSTHOG_PERSONAL_API_KEY
  const projectId = process.env.POSTHOG_PROJECT_ID

  // Sans clé — en local, en preview — rien à effacer : aucun événement n'y part.
  if (!key || !projectId) {
    console.warn('[posthog-admin] clé ou projet absent : effacement non tenté', userId)
    return 'skipped'
  }

  const base = `${API_HOST}/api/projects/${encodeURIComponent(projectId)}/persons`
  const headers = { Authorization: `Bearer ${key}` }

  try {
    const found = await fetch(`${base}/?distinct_id=${encodeURIComponent(userId)}`, {
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!found.ok) throw new Error(`recherche refusée (${found.status})`)

    const { results } = (await found.json()) as { results?: Array<{ id: string }> }
    // Un compte qui n'a jamais dit oui n'a jamais existé chez PostHog.
    if (!results?.length) return 'not_found'

    for (const person of results) {
      const removed = await fetch(
        `${base}/${encodeURIComponent(person.id)}/?delete_events=true`,
        { method: 'DELETE', headers, signal: AbortSignal.timeout(TIMEOUT_MS) },
      )
      if (!removed.ok) throw new Error(`suppression refusée (${removed.status})`)
    }
    return 'deleted'
  } catch (error) {
    console.error('[posthog-admin] effacement impossible', userId, error)
    Sentry.captureMessage('account_deletion_posthog_failed', {
      level: 'error',
      extra: { userId, reason: error instanceof Error ? error.message : String(error) },
    })
    return 'failed'
  }
}
