import { openConversationSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { listConversations, openConversation } from '@/lib/services/chat.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'

/**
 * Ouvre le fil d'un ancrage, ou retrouve le sien.
 *
 * Répond 200 et non 201 : l'appel est le même qu'on crée la conversation ou
 * qu'on la rouvre, et le client n'a pas à connaître la différence.
 */
export const POST = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, openConversationSchema)
  return ok(await openConversation(userId, input))
})

/** Les fils du compte, filtrables par plante. */
export const GET = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const plantInstanceId = new URL(request.url).searchParams.get('plantInstanceId') ?? undefined
  return ok(await listConversations(userId, plantInstanceId))
})
