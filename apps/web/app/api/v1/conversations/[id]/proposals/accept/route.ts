import { acceptProposalSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { acceptProposal } from '@/lib/services/chat.service'

export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'

type Context = { params: { id: string } }

/**
 * Exécute une proposition que l'utilisateur vient de confirmer.
 *
 * Le corps ne porte que `{ messageId, proposalId }` : c'est la proposition
 * écrite en base qui est exécutée, jamais celle que le client renverrait.
 */
export const POST = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, acceptProposalSchema)
  return ok(await acceptProposal(userId, params.id, input))
})
