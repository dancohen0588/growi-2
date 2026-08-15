import { Suspense } from 'react'
import { auth } from '@/auth'
import { getCurrentGardenAdvice } from '@/lib/services/advice.service'
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

  const current = await getCurrentGardenAdvice(session.user.id)

  const actions: GardenAction[] = current?.advice?.actions ?? []
  const alerts: PlantAlert[] = current?.advice?.alerts ?? []

  if (!current) {
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
      <CalendrierPageInner initialActions={actions} alerts={alerts} gardenId={current.gardenId} />
    </Suspense>
  )
}
