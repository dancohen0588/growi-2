import { deleteAccountSchema, updateProfileSchema } from '@growi/shared'

import { bearerAuthenticatedAt, requireUserId } from '@/lib/api/auth-context'
import { noContent, ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import * as userService from '@/lib/services/user.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

export const GET = withApiErrorHandling(async () => {
  const userId = await requireUserId()
  return ok(await userService.getProfile(userId))
})

export const PATCH = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, updateProfileSchema)
  return ok(await userService.updateProfile(userId, input))
})

/**
 * Supprime le compte. La route ne fait que transmettre la date de connexion
 * du jeton : c'est le service qui décide si la preuve de présence suffit —
 * mot de passe, ou connexion Apple/Google de moins de dix minutes.
 */
export const DELETE = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const input = await parseJsonBody(request, deleteAccountSchema)
  await userService.deleteAccount(userId, input, {
    authenticatedAt: await bearerAuthenticatedAt(),
  })
  return noContent()
})
