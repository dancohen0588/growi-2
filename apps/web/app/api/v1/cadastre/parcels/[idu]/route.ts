import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { getParcel } from '@/lib/services/cadastre.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

type Context = { params: { idu: string } }

/**
 * Le détail d'une parcelle, prêt à être posé sur le plan : contour et
 * bâtiments en mètres, contenance, terrain hors bâti.
 */
export const GET = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  await requireUserId()
  return ok(await getParcel(params.idu))
})
