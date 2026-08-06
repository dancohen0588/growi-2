import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { changePasswordSchema } from '@/lib/schemas/profil-schema'

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

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { password: true },
  })
  if (!user?.password) {
    return NextResponse.json(
      { error: 'Aucun mot de passe défini sur ce compte.' },
      { status: 400 },
    )
  }

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.password)
  if (!ok) {
    return NextResponse.json(
      { error: 'Mot de passe actuel incorrect.' },
      { status: 401 },
    )
  }

  const hashed = await bcrypt.hash(parsed.data.newPassword, 12)
  await prisma.user.update({
    where: { id: session.user.id },
    data: { password: hashed },
  })

  return NextResponse.json({ ok: true })
}
