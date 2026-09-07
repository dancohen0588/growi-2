import { createReportSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { created, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as moderationService from '@/lib/services/community/moderation.service'

export const dynamic = 'force-dynamic'

/**
 * Signaler un contenu ou un compte.
 *
 * 201 même quand le signalement existait déjà : l'appel est idempotent, et
 * distinguer les deux cas apprendrait au signaleur qu'il s'y est déjà pris —
 * information sans usage pour lui, et qui compliquerait l'écran.
 */
export const POST = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, createReportSchema)
  return created(await moderationService.report(userId, input))
})
