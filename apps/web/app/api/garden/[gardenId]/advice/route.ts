import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { isServiceError } from '@/lib/services/errors'
import { getGardenAdvice } from '@/lib/services/advice.service'

export async function GET(
  _request: Request,
  { params }: { params: { gardenId: string } },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    const result = await getGardenAdvice(params.gardenId, session.user.id)

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  } catch (err) {
    if (isServiceError(err) && err.code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Jardin introuvable' }, { status: 403 })
    }
    console.error('[api/garden/advice GET]', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération des conseils.' },
      { status: 500 },
    )
  }
}
