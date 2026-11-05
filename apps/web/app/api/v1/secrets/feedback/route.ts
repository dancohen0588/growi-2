import { secretFeedbackSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { noContent, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { recordSecretFeedback } from '@/lib/services/secrets.service'

export const dynamic = 'force-dynamic'

/** « Ça a marché ? » — le verdict sur un essai. Refait, il remplace le précédent. */
export const POST = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  await recordSecretFeedback(userId, await parseJsonBody(request, secretFeedbackSchema))
  return noContent()
})
