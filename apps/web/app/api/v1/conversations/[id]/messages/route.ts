import { sendMessageSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { sseResponse } from '@/lib/api/sse'
import { sendMessage } from '@/lib/services/chat.service'

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'

/**
 * Streaming : la réponse peut demander une trentaine de secondes au modèle, là
 * où le défaut de Vercel en accorde dix.
 */
export const maxDuration = 60

type Context = { params: { id: string } }

/**
 * Envoie un message et rend la réponse au fil de l'eau (SSE).
 *
 * Tout ce qui peut refuser la requête — quota atteint, photo illisible, fil
 * d'un autre compte — est levé par le service **avant** l'ouverture du flux,
 * et sort donc en JSON avec le bon statut (429, 400, 404). Une fois le flux
 * ouvert, une panne devient un événement `error` : on ne peut plus changer le
 * statut d'une réponse déjà commencée.
 */
export const POST = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, sendMessageSchema)

  const started = await sendMessage(userId, params.id, input)
  return sseResponse(started.stream())
})
