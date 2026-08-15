import { NextResponse } from 'next/server'

import { auth } from '@/auth'
import { isServiceError } from '@/lib/services/errors'
import { identifyPlant } from '@/lib/services/identify.service'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = (await request.json().catch(() => null)) as
    | { imageBase64?: unknown }
    | null

  try {
    return NextResponse.json(await identifyPlant(body?.imageBase64))
  } catch (err) {
    if (isServiceError(err)) {
      const status = err.code === 'UNAVAILABLE' ? 503 : 400
      return NextResponse.json({ error: err.message }, { status })
    }
    throw err
  }
}
