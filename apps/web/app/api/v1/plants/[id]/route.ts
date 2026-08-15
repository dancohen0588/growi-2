import { updatePlantInstanceSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { noContent, ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { serializePlantInstanceWithRelations } from '@/lib/api/serializers'
import { ServiceError } from '@/lib/services/errors'
import * as plantService from '@/lib/services/plant.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

type Context = { params: { id: string } }

export const GET = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  const plant = await plantService.findPlantInstance(params.id, userId)
  if (!plant) throw new ServiceError('NOT_FOUND', 'Plante introuvable')
  return ok(serializePlantInstanceWithRelations(plant))
})

export const PATCH = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, updatePlantInstanceSchema)
  const plant = await plantService.updatePlantInstance(params.id, userId, input)
  return ok(serializePlantInstanceWithRelations(plant))
})

export const DELETE = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  await plantService.deletePlantInstance(params.id, userId)
  return noContent()
})
