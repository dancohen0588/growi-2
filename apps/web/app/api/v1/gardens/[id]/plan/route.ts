import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { buildGardenPlan } from '@/lib/garden/plan-svg'
import { ServiceError } from '@/lib/services/errors'
import * as gardenService from '@/lib/services/garden.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

type Context = { params: { id: string } }

/**
 * Le plan dessiné du jardin, composé en SVG.
 *
 * Servi à part de `GET /gardens/[id]` : un plan pèse plusieurs dizaines de
 * kilo-octets, et la fiche jardin est demandée bien plus souvent qu'il n'est
 * affiché. Répond 404 tant que rien n'a été dessiné — l'app montre alors son
 * invitation à ouvrir l'éditeur sur un ordinateur.
 */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()

  const garden = await gardenService.findGarden(params.id, userId)
  if (!garden) throw new ServiceError('NOT_FOUND', 'Jardin introuvable')

  const plan = buildGardenPlan(garden.canvasData)
  if (!plan) throw new ServiceError('NOT_FOUND', "Ce jardin n'a pas encore de plan")

  return ok(plan)
})
