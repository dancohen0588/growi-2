import { updateAlertConfigSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as userService from '@/lib/services/user.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

/** Préférences d'alertes. Elles sont aussi renvoyées avec le profil. */
export const GET = withApiErrorHandling(async () => {
  const userId = await requireUserId()
  return ok(await userService.getAlertConfig(userId))
})

/**
 * Mise à jour partielle : le corps ne porte que ce qui change, le service
 * fusionne avec l'existant et les valeurs par défaut.
 */
export const PATCH = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, updateAlertConfigSchema)
  return ok(await userService.updateAlertConfig(userId, input))
})
