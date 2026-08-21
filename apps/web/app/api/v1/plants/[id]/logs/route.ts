import { createCareLogSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { created, ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { serializeCareLog } from '@/lib/api/serializers'
import * as logService from '@/lib/services/log.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

type Context = { params: { id: string } }

/** Historique d'entretien d'une plante, du plus récent au plus ancien. */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  const logs = await logService.listPlantLogs(params.id, userId)
  return ok(logs.map(serializeCareLog))
})

/**
 * Enregistre un geste d'entretien, quel qu'il soit.
 *
 * Un seul endpoint et un seul corps : ajouter un geste au domaine ne demande
 * plus de toucher à cette route.
 */
export const POST = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, createCareLogSchema)
  const log = await logService.logCare(params.id, userId, input)
  return created(serializeCareLog(log))
})
