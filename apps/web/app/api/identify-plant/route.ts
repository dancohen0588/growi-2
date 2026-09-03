import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { isServiceError } from '@/lib/services/errors'
import { parseImagePayload } from '@/lib/services/gemini'
import { identifyPlant } from '@/lib/services/identify.service'
import {
  QUOTA_REACHED_MESSAGE,
  consumeAnonymousIdentifyQuota,
} from '@/lib/services/identify-quota.service'

export const runtime = 'nodejs'

/**
 * Cette route sert deux surfaces : le tableau de bord et, depuis la refonte,
 * la page publique `/identifier`.
 *
 * Un appel anonyme est donc accepté, mais décompté : chaque identification
 * coûte un appel Gemini, et un visiteur non connecté n'a ni quota ni compte à
 * suspendre. Les utilisateurs connectés gardent leur comportement d'avant —
 * aucun plafond ajouté ici.
 */
export async function POST(request: Request) {
  const session = await auth()

  const body = (await request.json().catch(() => null)) as
    | { imageBase64?: unknown }
    | null

  try {
    // La photo est validée avant d'être décomptée : une image malformée
    // n'atteint jamais Gemini, elle ne doit donc rien coûter au visiteur.
    // Le contrôle est local, et le même que celui du service.
    parseImagePayload(body?.imageBase64)

    if (!session?.user?.id) {
      const quota = await consumeAnonymousIdentifyQuota(request.headers)
      if (!quota.allowed) {
        return NextResponse.json({ error: QUOTA_REACHED_MESSAGE }, { status: 429 })
      }
    }

    return NextResponse.json(await identifyPlant(body?.imageBase64))
  } catch (err) {
    if (isServiceError(err)) {
      const status = err.code === 'UNAVAILABLE' ? 503 : 400
      return NextResponse.json({ error: err.message }, { status })
    }
    throw err
  }
}
