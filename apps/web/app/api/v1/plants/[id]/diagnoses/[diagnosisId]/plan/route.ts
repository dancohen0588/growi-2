import { planDiagnosisSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { planDiagnosisActions } from '@/lib/services/task.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

type Context = { params: { id: string; diagnosisId: string } }

/**
 * Transforme les recommandations d'un diagnostic en tâches du planning, et
 * retire celles que l'utilisateur a marquées « retirer » dans la revue.
 *
 * Corps facultatif : sans lui, la route ne fait qu'exécuter ce que le
 * diagnostic contient déjà, comme avant la revue. Aucun appel au modèle, donc
 * aucune limite de débit à poser.
 *
 * Idempotente — rejouer l'appel renvoie l'état existant plutôt qu'une erreur :
 * le bouton peut être tapé deux fois, et rouvrir un diagnostic depuis
 * l'historique ne doit pas échouer.
 */
export const POST = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const userId = await requireUserId()

  // Un corps vide est la norme sur cette route : `request.json()` lèverait.
  const raw = await request.text()
  const input = raw ? planDiagnosisSchema.parse(JSON.parse(raw)) : {}

  return ok(await planDiagnosisActions(userId, params.id, params.diagnosisId, input))
})
