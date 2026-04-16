import { Suspense } from 'react'
import { auth } from '@/auth'
import { prisma } from '@/lib/prisma'
import { getGardenAdvice } from '@/lib/recommendation/garden-advice-service'
import { CalendrierPageInner } from './CalendrierPageInner'
import type { GardenAction, PlantAlert } from '@/lib/recommendation/types'

export default async function CalendrierPage() {
  const session = await auth()
  if (!session?.user?.id) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 font-raleway text-forest/60">
        <p>Connecte-toi pour accéder à ton calendrier.</p>
      </div>
    )
  }

  const garden = await prisma.garden.findFirst({
    where: { userId: session.user.id },
    select: { id: true },
    orderBy: { createdAt: 'desc' },
  })

  let actions: GardenAction[] = []
  let alerts: PlantAlert[] = []

  if (garden) {
    try {
      const result = await getGardenAdvice(garden.id, session.user.id)
      actions = result.actions
      alerts = result.alerts
    } catch (err) {
      console.error('[CalendrierPage] advice error:', err)
    }
  }

  if (!garden) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <p className="font-poppins font-bold text-xl text-forest">
          Crée d&apos;abord un jardin 🌱
        </p>
        <p className="font-raleway text-forest/60 text-center max-w-md">
          Pour recevoir des recommandations personnalisées, commence par créer ton premier jardin dans la section &quot;Mon jardin&quot;.
        </p>
      </div>
    )
  }

  return (
    <Suspense>
      <CalendrierPageInner initialActions={actions} alerts={alerts} gardenId={garden.id} />
    </Suspense>
  )
}
