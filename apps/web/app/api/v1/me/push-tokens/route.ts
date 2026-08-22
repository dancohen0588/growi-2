import { registerPushTokenSchema, unregisterPushTokenSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { noContent, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as pushService from '@/lib/services/push.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

/**
 * Enregistre l'appareil courant pour les notifications.
 *
 * Appelé à chaque ouverture de l'app : le jeton Expo change après une
 * réinstallation, et l'opération est idempotente.
 */
export const POST = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, registerPushTokenSchema)

  await pushService.registerPushToken(userId, input)
  return noContent()
})

/** Oublie l'appareil — à la déconnexion, ou quand l'utilisateur refuse. */
export const DELETE = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const { token } = await parseJsonBody(request, unregisterPushTokenSchema)

  await pushService.unregisterPushToken(userId, token)
  return noContent()
})
