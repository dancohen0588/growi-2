import { secretSlugSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { noContent, withApiErrorHandling } from '@/lib/api/response'
import { revealSecret } from '@/lib/services/secrets.service'

export const dynamic = 'force-dynamic'

type Context = { params: { slug: string } }

/** Le secret a été dévoilé : il entre au grimoire. Idempotent. */
export const POST = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  await revealSecret(userId, secretSlugSchema.parse(params.slug))
  return noContent()
})
