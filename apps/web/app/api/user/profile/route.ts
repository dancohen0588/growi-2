import { NextResponse } from 'next/server'
import { updateProfileSchema } from '@growi/shared'

import { auth } from '@/auth'
import { isServiceError } from '@/lib/services/errors'
import * as userService from '@/lib/services/user.service'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  try {
    return NextResponse.json(await userService.getProfile(session.user.id))
  } catch (err) {
    if (isServiceError(err) && err.code === 'NOT_FOUND') {
      return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
    }
    throw err
  }
}

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = updateProfileSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 400 },
    )
  }

  try {
    return NextResponse.json(await userService.updateProfile(session.user.id, parsed.data))
  } catch (err) {
    if (isServiceError(err) && err.code === 'CONFLICT') {
      return NextResponse.json({ error: err.message }, { status: 409 })
    }
    console.error('[api/user/profile PATCH]', err)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du profil.' },
      { status: 500 },
    )
  }
}
