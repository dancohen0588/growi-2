import { NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { z } from 'zod'

import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { defaultAlertConfig, type AlertConfig } from '@/lib/user-types'

const alertConfigSchema = z.object({
  frostAlert: z.boolean(),
  frostThreshold: z.number().int().min(-5).max(5),
  heatAlert: z.boolean(),
  rainAlert: z.boolean(),
  windAlert: z.boolean(),
  wateringReminder: z.boolean(),
  wateringFrequencyDays: z.number().int().min(1).max(30),
  repottingReminder: z.boolean(),
  pruningReminder: z.boolean(),
  seedingAlerts: z.boolean(),
  harvestAlerts: z.boolean(),
  channel: z.enum(['push', 'email', 'both', 'none']),
  frequency: z.enum(['immediate', 'daily_digest', 'weekly_digest']),
  quietHoursEnabled: z.boolean(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/),
})

const patchSchema = alertConfigSchema.partial()

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
