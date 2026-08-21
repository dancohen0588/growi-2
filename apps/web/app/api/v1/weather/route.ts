import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import { getGardenWeather } from '@/lib/services/garden-weather.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

/** Météo du jardin : prévision à sept jours, contexte et conseils de la semaine. */
export const GET = withApiErrorHandling(async () => {
  const userId = await requireUserId()
  return ok(await getGardenWeather(userId))
})
