import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { defaultAlertConfig, type AlertConfig, type UserProfile } from '@/lib/user-types'

const patchSchema = z.object({
  firstName: z.string().min(2).optional(),
  lastName: z.string().min(2).optional(),
  email: z.string().email().optional(),
  address: z.string().optional().nullable(),
  gardenType: z
    .enum(['potager', 'ornement', 'mixte', 'interieur', 'balcon'])
    .optional()
    .nullable(),
  avatarColor: z.string().optional().nullable(),
})

function toProfile(user: {
  firstName: string | null
  lastName: string | null
  name: string | null
  email: string
  address: string | null
  gardenType: string | null
  avatarColor: string | null
  alertConfig: Prisma.JsonValue | null
}): UserProfile {
  return {
    firstName: user.firstName ?? user.name ?? '',
    lastName: user.lastName ?? '',
    email: user.email,
    address: user.address ?? undefined,
    avatarColor: user.avatarColor ?? undefined,
    gardenType: (user.gardenType ?? undefined) as UserProfile['gardenType'],
    alertConfig: (user.alertConfig as AlertConfig | null) ?? defaultAlertConfig,
  }
}

export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      firstName: true,
      lastName: true,
      name: true,
      email: true,
      address: true,
      gardenType: true,
      avatarColor: true,
      alertConfig: true,
    },
  })

  if (!user) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  }

  return NextResponse.json(toProfile(user))
}

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
    const updated = await prisma.user.update({
      where: { id: session.user.id },
      data: parsed.data,
      select: {
        firstName: true,
        lastName: true,
        name: true,
        email: true,
        address: true,
        gardenType: true,
        avatarColor: true,
        alertConfig: true,
      },
    })
    return NextResponse.json(toProfile(updated))
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === 'P2002'
    ) {
      return NextResponse.json(
        { error: 'Cet email est déjà utilisé.' },
        { status: 409 },
      )
    }
    console.error('[api/user/profile PATCH]', err)
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du profil.' },
      { status: 500 },
    )
  }
}
