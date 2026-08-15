import { createCareLogSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { created, ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import {
  serializeFertilizingLog,
  serializeHealthLog,
  serializePruningLog,
  serializeWateringLog,
} from '@/lib/api/serializers'
import * as logService from '@/lib/services/log.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

type Context = { params: { id: string } }

/** Historique d'entretien d'une plante, groupé par type d'intervention. */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  const logs = await logService.listPlantLogs(params.id, userId)

  return ok({
    watering: logs.watering.map(serializeWateringLog),
    pruning: logs.pruning.map(serializePruningLog),
    fertilizing: logs.fertilizing.map(serializeFertilizingLog),
    health: logs.health.map(serializeHealthLog),
  })
})

/**
 * Enregistre une intervention. Un seul endpoint pour les quatre types, le
 * corps étant discriminé par son champ `type`.
 */
export const POST = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, createCareLogSchema)
  const plantId = params.id

  switch (input.type) {
    case 'watering': {
      const log = await logService.logWatering(plantId, userId, {
        note: input.note,
        wateredAt: input.wateredAt ? new Date(input.wateredAt) : undefined,
      })
      return created({ type: input.type, log: serializeWateringLog(log) })
    }
    case 'pruning': {
      const log = await logService.logPruning(plantId, userId, {
        note: input.note,
        pruningType: input.pruningType,
        prunedAt: input.prunedAt ? new Date(input.prunedAt) : undefined,
      })
      return created({ type: input.type, log: serializePruningLog(log) })
    }
    case 'fertilizing': {
      const log = await logService.logFertilizing(plantId, userId, {
        note: input.note,
        productUsed: input.productUsed,
        fertilizedAt: input.fertilizedAt ? new Date(input.fertilizedAt) : undefined,
      })
      return created({ type: input.type, log: serializeFertilizingLog(log) })
    }
    case 'health': {
      const log = await logService.logHealth(plantId, userId, input.status, {
        note: input.note,
        photoUrl: input.photoUrl,
        loggedAt: input.loggedAt ? new Date(input.loggedAt) : undefined,
      })
      return created({ type: input.type, log: serializeHealthLog(log) })
    }
  }
})
