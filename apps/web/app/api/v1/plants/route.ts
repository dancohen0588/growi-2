import { addIdentifiedPlantSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { created, ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { serializePlantInstanceWithRelations } from '@/lib/api/serializers'
import * as plantService from '@/lib/services/plant.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

/**
 * Toutes les plantes de l'utilisateur, tous jardins confondus — l'onglet
 * « Mes plantes », qui répond à « où est mon basilic ? » sans passer par le
 * jardin qui l'héberge.
 */
export const GET = withApiErrorHandling(async () => {
  const userId = await requireUserId()

  const plants = await plantService.listPlantInstances(userId)
  return ok(plants.map(serializePlantInstanceWithRelations))
})

/**
 * Ajoute une plante reconnue en photo.
 *
 * Sans jardin dans le corps : la plante rejoint le plus récent, et hérite de
 * la fiche du catalogue quand l'espèce y figure. Créer une plante dans un
 * jardin choisi passe par `POST /api/v1/gardens/[id]/plants`.
 */
export const POST = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, addIdentifiedPlantSchema)

  const plant = await plantService.addIdentifiedPlant(userId, input)
  return created(serializePlantInstanceWithRelations(plant))
})
