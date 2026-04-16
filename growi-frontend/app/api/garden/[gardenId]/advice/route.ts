import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getGardenAdvice } from '@/lib/recommendation/garden-advice-service'

export async function GET(
  _request: Request,
  { params }: { params: { gardenId: string } },
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { gardenId } = params

  const garden = await prisma.garden.findFirst({
    where: { id: gardenId, userId: session.user.id },
    select: { id: true },
  })

  if (!garden) {
    return NextResponse.json({ error: 'Jardin introuvable' }, { status: 403 })
  }

  try {
    const result = await getGardenAdvice(gardenId, session.user.id)

    return NextResponse.json(result, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    })
  } catch (err) {
    console.error('[api/garden/advice GET]', err)
    return NextResponse.json(
      { error: 'Erreur lors de la génération des conseils.' },
      { status: 500 },
    )
  }
}
