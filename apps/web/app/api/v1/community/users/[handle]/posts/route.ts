import { optionalUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import * as postService from '@/lib/services/community/post.service'
import * as profileService from '@/lib/services/community/profile.service'

export const dynamic = 'force-dynamic'

type Context = { params: { handle: string } }

/**
 * Les publications d'un compte — la grille de son profil public.
 *
 * Lisible sans compte, comme le profil lui-même. Le pseudo est d'abord résolu
 * par `getProfileByHandle`, qui applique les mêmes règles de visibilité :
 * répondre une liste vide pour un profil masqué laisserait croire qu'il existe
 * et n'a rien publié.
 */
export const GET = withApiErrorHandling(async (request: Request, { params }: Context) => {
  const viewerId = await optionalUserId()
  const profile = await profileService.getProfileByHandle(params.handle, viewerId)
  const cursor = new URL(request.url).searchParams.get('cursor')

  return ok(await postService.listUserPosts(profile.id, viewerId, cursor))
})
