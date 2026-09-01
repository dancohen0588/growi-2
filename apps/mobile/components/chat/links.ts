import type { GardenAction } from '@growi/shared'

/**
 * Les chaînes de requête qui ancrent un fil de discussion.
 *
 * L'écran de discussion est le même dans les quatre piles de navigation ; ce
 * qui change d'un point d'entrée à l'autre, c'est l'ancrage. Il voyage donc
 * dans l'URL, et se compose ici une seule fois — trois écrans le fabriquaient
 * sinon chacun à sa façon.
 */

/** Question libre sur la plante. */
export function plantChatQuery(): string {
  return '?kind=plant'
}

/** Fil d'un diagnostic, avec au besoin une question déjà écrite. */
export function diagnosisChatQuery(diagnosisId: string, draft?: string): string {
  const params = new URLSearchParams({ kind: 'diagnosis', diagnosisId })
  if (draft) params.set('draft', draft)
  return `?${params.toString()}`
}

/**
 * Fil d'une action du calendrier.
 *
 * Le cliché de l'action part avec : les actions du moteur sont recalculées à
 * chaque évaluation et ne sont persistées nulle part, le serveur ne saurait
 * donc pas retrouver celle qu'on avait sous les yeux.
 */
export function actionChatQuery(action: GardenAction): string {
  const snapshot = {
    type: action.type,
    label: action.label,
    shortLabel: action.shortLabel,
    dueDate: action.dueDate,
    priority: action.priority,
    ...(action.source ? { source: action.source } : {}),
  }

  const params = new URLSearchParams({ kind: 'action', action: JSON.stringify(snapshot) })

  // Une tâche persistée s'acquitte par son identifiant ; une action du moteur
  // n'a que celui, déterministe, que le moteur lui donne.
  if (action.taskId) params.set('taskId', action.taskId)
  else params.set('actionKey', action.id)

  return `?${params.toString()}`
}
