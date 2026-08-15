import { NextResponse } from 'next/server'
import { updateAlertConfigSchema } from '@growi/shared'

import { auth } from '@/auth'
import * as userService from '@/lib/services/user.service'

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = updateAlertConfigSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 400 },
    )
  }

  try {
    const merged = await userService.updateAlertConfig(session.user.id, parsed.data)
    return NextResponse.json(merged)
  } catch (err) {
    console.error('[api/user/alerts PATCH]', err)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour des alertes.' },
      { status: 500 },
    )
  }
}
