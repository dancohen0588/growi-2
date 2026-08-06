'use server'

import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'
import { revalidatePath } from 'next/cache'
import { createGardenSchema, type CreateGardenInput } from '@growi/shared'

const gardenSchema = createGardenSchema

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

export async function createGarden(data: CreateGardenInput) {
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
