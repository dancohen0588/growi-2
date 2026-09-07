import { optionalUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import * as profileService from '@/lib/services/community/profile.service'

export const dynamic = 'force-dynamic'

type Context = { params: { handle: string } }

/** Qui ce compte suit. */
export const GET = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const viewerId = await optionalUserId()
  const cursor = new URL(request.url).searchParams.get('cursor')

  return ok(await profileService.listFollows(params.handle, viewerId, 'following', cursor))
})
