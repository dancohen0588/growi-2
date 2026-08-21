import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
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
