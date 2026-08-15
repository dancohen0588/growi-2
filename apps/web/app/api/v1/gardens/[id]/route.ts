import { updateGardenSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { noContent, ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { serializeGarden, serializeGardenWithStats } from '@/lib/api/serializers'
import { ServiceError } from '@/lib/services/errors'
import * as gardenService from '@/lib/services/garden.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

type Context = { params: { id: string } }

export const GET = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  const garden = await gardenService.findGarden(params.id, userId)
  if (!garden) throw new ServiceError('NOT_FOUND', 'Jardin introuvable')
  return ok(serializeGardenWithStats(garden))
})

export const PATCH = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, updateGardenSchema)
  const garden = await gardenService.updateGarden(params.id, userId, input)
  return ok(serializeGarden(garden))
})

export const DELETE = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  await gardenService.assertGardenOwned(params.id, userId)
  await gardenService.deleteGarden(params.id, userId)
  return noContent()
})
