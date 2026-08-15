import { NextResponse } from 'next/server'
import { changePasswordSchema } from '@growi/shared'

import { auth } from '@/auth'
import { isServiceError } from '@/lib/services/errors'
import * as userService from '@/lib/services/user.service'

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = changePasswordSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 400 },
    )
  }

  try {
    await userService.changePassword(
      session.user.id,
      parsed.data.currentPassword,
      parsed.data.newPassword,
    )
  } catch (err) {
    if (isServiceError(err)) {
      // Aucun mot de passe sur le compte → 400 ; mot de passe actuel faux → 401.
      const status = err.code === 'INVALID_INPUT' ? 400 : 401
      return NextResponse.json({ error: err.message }, { status })
    }
    throw err
  }

  return NextResponse.json({ ok: true })
}
