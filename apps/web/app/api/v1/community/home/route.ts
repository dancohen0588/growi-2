import { requireUserId } from '@/lib/api/auth-context'
import { ok, withApiErrorHandling } from '@/lib/api/response'
import * as postService from '@/lib/services/community/post.service'

export const dynamic = 'force-dynamic'

/**
 * La carte « Autour de toi » de l'Accueil.
 *
 * Route à part, et non un champ de plus dans `/api/v1/summary` : c'est
 * l'appel le plus chaud de l'app, et une requête géographique n'a pas à
 * retarder l'affichage du jardin. L'écran la charge après le reste, et
 * n'affiche rien tant que le profil public n'est pas activé.
 */
export const GET = withApiErrorHandling(async () => {
  const userId = await requireUserId()
  return ok(await postService.getHome(userId))
})
