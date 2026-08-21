import { z } from 'zod'

import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { serializePlantCatalog } from '@/lib/api/serializers'
import * as plantService from '@/lib/services/plant.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

const querySchema = z.object({
  /** Terme recherché : nom commun, nom scientifique ou alias. */
  q: z.string().max(100).optional(),
  category: z.string().max(40).optional(),
})

/**
 * Recherche dans le catalogue d'espèces, pour l'autocomplétion à l'ajout
 * d'une plante. Le catalogue est commun à tous les utilisateurs : la route
 * reste authentifiée, mais ne filtre pas par compte.
 */
export const GET = withApiErrorHandling(async (request: Request) => {
  await requireUserId()

  const { searchParams } = new URL(request.url)
  const { q, category } = querySchema.parse({
    q: searchParams.get('q') ?? undefined,
    category: searchParams.get('category') ?? undefined,
  })

  const plants = await plantService.searchCatalog(q ?? '', category)
  return ok(plants.map(serializePlantCatalog))
})
