import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { planDiagnosisActions } from '@/lib/services/task.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

type Context = { params: { id: string; diagnosisId: string } }

/**
 * Transforme les recommandations d'un diagnostic en tâches du planning.
 *
 * Pas de corps : la route ne fait qu'exécuter ce que le diagnostic contient
 * déjà. Aucun appel au modèle non plus, donc aucune limite de débit à poser.
 *
 * Idempotente — rejouer l'appel renvoie l'état existant plutôt qu'une erreur :
 * le bouton peut être tapé deux fois, et rouvrir un diagnostic depuis
 * l'historique ne doit pas échouer.
 */
export const POST = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  return ok(await planDiagnosisActions(userId, params.id, params.diagnosisId))
})
