import { createPlantInstanceSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { created, ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { serializePlantInstanceWithRelations } from '@/lib/api/serializers'
import * as gardenService from '@/lib/services/garden.service'
import * as plantService from '@/lib/services/plant.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

type Context = { params: { id: string } }

/** Plantes d'un jardin. */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  await gardenService.assertGardenOwned(params.id, userId)

  const plants = await plantService.listPlantInstances(userId, params.id)
  return ok(plants.map(serializePlantInstanceWithRelations))
})

/**
 * Ajoute une plante à ce jardin. Le `gardenId` du corps est ignoré : celui de
 * l'URL fait foi.
 */
export const POST = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const userId = await requireUserId()
  await gardenService.assertGardenOwned(params.id, userId)

  const input = await parseJsonBody(request, createPlantInstanceSchema)
  const plant = await plantService.createPlantInstance(userId, {
    ...input,
    gardenId: params.id,
  })
  return created(serializePlantInstanceWithRelations(plant))
})
