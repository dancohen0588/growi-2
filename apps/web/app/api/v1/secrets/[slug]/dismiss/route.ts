import { secretSlugSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { noContent, withApiErrorHandling } from '@/lib/api/response'
import { dismissSecret, restoreSecret } from '@/lib/services/secrets.service'

export const dynamic = 'force-dynamic'

type Context = { params: { slug: string } }

/** « Pas pour moi » : le secret ne sera plus proposé. */
export const POST = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  await dismissSecret(userId, secretSlugSchema.parse(params.slug))
  return noContent()
})

/** Revenir sur un « Pas pour moi », depuis le grimoire. */
export const DELETE = withApiErrorHandling(async (_request: Request, { params }: Context) => {
  const userId = await requireUserId()
  await restoreSecret(userId, secretSlugSchema.parse(params.slug))
  return noContent()
})
