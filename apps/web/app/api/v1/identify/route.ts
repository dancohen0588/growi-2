import { z } from 'zod'

import { requireUserId } from '@/lib/api/auth-context'
import { ok, parseJsonBody, withApiErrorHandling } from '@/lib/api/response'
import { identifyPlant } from '@/lib/services/identify.service'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'

const identifyBodySchema = z.object({
  /** Photo au format data URL base64 (`data:image/jpeg;base64,...`), 4 Mo max. */
  imageBase64: z.string().min(1, 'Image requise'),
})

export const POST = withApiErrorHandling(async (request: Request) => {
  await requireUserId()
  const { imageBase64 } = await parseJsonBody(request, identifyBodySchema)
  return ok(await identifyPlant(imageBase64))
})
