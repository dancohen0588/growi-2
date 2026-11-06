import { setSapHomeThemeSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { setHomeTheme } from '@/lib/services/sap-rewards.service'

export const dynamic = 'force-dynamic'

/**
 * Choisit le thème d'Accueil débloqué par un cerne — `{ theme: null }` revient
 * au classique. 200 `{ homeTheme }` ; 403 pour un thème pas encore débloqué.
 */
export const PUT = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  const { theme } = await parseJsonBody(request, setSapHomeThemeSchema)
  return ok({ homeTheme: await setHomeTheme(userId, theme) })
})
