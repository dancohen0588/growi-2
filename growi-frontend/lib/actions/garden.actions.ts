'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const gardenSchema = z.object({
  name:        z.string().min(1, 'Nom requis').max(50),
  type:        z.enum(['OUTDOOR', 'INDOOR', 'BALCONY', 'GREENHOUSE', 'ALLOTMENT']),
  description: z.string().max(500).optional(),
  surfaceM2:   z.number().positive().optional(),
})

export async function getUserGardens() {
  const session = await auth()
  if (!session?.user?.id) return []

  return prisma.garden.findMany({
    where:   { userId: session.user.id },
    include: { zones: true, _count: { select: { plantInstances: true } } },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getOrCreateDefaultGarden() {
  const session = await auth()
  if (!session?.user?.id) return null

  const existing = await prisma.garden.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: 'asc' },
  })
  if (existing) return existing

  return prisma.garden.create({
    data: {
      userId: session.user.id,
      name:   'Mon jardin',
      type:   'OUTDOOR',
    },
  })
}

export async function createGarden(data: z.infer<typeof gardenSchema>) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  const validated = gardenSchema.parse(data)
  const garden = await prisma.garden.create({
    data: { ...validated, userId: session.user.id },
  })

  revalidatePath('/dashboard/jardin')
  return { success: true, garden }
}

export async function updateGardenCanvas(gardenId: string, canvasData: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await prisma.garden.update({
    where: { id: gardenId, userId: session.user.id },
    data:  { canvasData },
  })

  revalidatePath('/dashboard/jardin')
  return { success: true }
}

export async function deleteGarden(gardenId: string) {
  const session = await auth()
  if (!session?.user?.id) throw new Error('Non authentifié')

  await prisma.garden.delete({
    where: { id: gardenId, userId: session.user.id },
  })

  revalidatePath('/dashboard/jardin')
  return { success: true }
}
