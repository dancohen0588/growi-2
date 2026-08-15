import { createGardenSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { created, ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { serializeGarden, serializeGardenWithStats } from '@/lib/api/serializers'
import * as gardenService from '@/lib/services/garden.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

/** Jardins de l'utilisateur, avec leurs zones et leur nombre de plantes. */
export const GET = withApiErrorHandling(async () => {
  const userId = await requireUserId()
  const gardens = await gardenService.listGardens(userId)
  return ok(gardens.map(serializeGardenWithStats))
})

export const POST = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, createGardenSchema)
  const garden = await gardenService.createGarden(userId, input)
  return created(serializeGarden(garden))
})
