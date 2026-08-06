import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { updateAlertConfigSchema } from '@growi/shared'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { defaultAlertConfig, type AlertConfig } from '@/lib/user-types'

const patchSchema = updateAlertConfigSchema

export async function PATCH(request: Request) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Données invalides' },
      { status: 400 },
    )
  }

  try {
    const current = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { alertConfig: true },
    })
    const merged: AlertConfig = {
      ...defaultAlertConfig,
      ...((current?.alertConfig as AlertConfig | null) ?? {}),
      ...parsed.data,
    }

    await prisma.user.update({
      where: { id: session.user.id },
      data: { alertConfig: merged as unknown as Prisma.InputJsonValue },
    })

    return NextResponse.json(merged)
  } catch (err) {
    console.error('[api/user/alerts PATCH]', err)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour des alertes.' },
      { status: 500 },
    )
  }
}
