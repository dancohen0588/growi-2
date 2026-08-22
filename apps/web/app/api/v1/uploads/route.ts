import { photoKindSchema } from '@growi/shared'

import { requireUserId } from '@/lib/api/auth-context'
import { enforceRateLimit } from '@/lib/api/rate-limit'
import { created, withApiErrorHandling } from '@/lib/api/response'
import { ServiceError } from '@/lib/services/errors'
import { uploadPhoto } from '@/lib/storage'

// Routes authentifiées : jamais de rendu statique.
export const dynamic = 'force-dynamic'

export const runtime = 'nodejs'

/**
 * Le stockage se paie à l'octet : on borne ce qu'un compte peut déposer en une
 * heure. La limite porte sur l'utilisateur, pas sur l'IP — la route est
 * authentifiée, c'est le compte qui engage la dépense.
 */
const RATE_LIMIT = { limit: 30, windowMs: 60 * 60 * 1000 }

/**
 * Dépose une photo et renvoie son URL publique.
 *
 * L'appelant écrit ensuite cette URL où il veut — `photoUrl` d'une plante ou
 * d'un geste — par les routes habituelles. L'envoi et le rattachement sont
 * séparés : une photo déposée puis abandonnée ne casse rien.
 */
export const POST = withApiErrorHandling(async (request: Request) => {
  const userId = await requireUserId()
  enforceRateLimit(`upload:${userId}`, RATE_LIMIT)

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    throw new ServiceError('INVALID_INPUT', 'Envoi invalide : un fichier est attendu.')
  }

  const file = form.get('file')
  if (!(file instanceof File)) {
    throw new ServiceError('INVALID_INPUT', 'Aucun fichier reçu.')
  }

  const kind = photoKindSchema.safeParse(form.get('kind') ?? 'plant')
  if (!kind.success) {
    throw new ServiceError('INVALID_INPUT', 'Type de photo inconnu.')
  }

  const photo = await uploadPhoto(userId, kind.data, {
    bytes: await file.arrayBuffer(),
    contentType: file.type,
  })

  return created({ url: photo.url })
})
