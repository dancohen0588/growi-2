import { Suspense } from 'react'
import { auth } from '@/auth'
import { getGardensAdvice } from '@/lib/services/advice.service'
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

  // Tous les jardins, comme l'Accueil et le Calendrier de l'app : s'en tenir
  // au dernier créé taisait le travail à faire dans les autres.
  const gardens = await getGardensAdvice(session.user.id)

  if (gardens.length === 0) {
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

  // Une plante sans jardin est rattachée à chacun d'eux par le moteur : sans
  // cette mémoire, sa tâche apparaîtrait autant de fois qu'il y a de jardins.
  const actions: GardenAction[] = []
  const alerts: PlantAlert[] = []
  const seenActions = new Set<string>()
  const seenAlerts = new Set<string>()
  /** Jardin d'où vient chaque action — c'est lui qu'on acquitte au clic. */
  const actionGardenIds: Record<string, string> = {}

  for (const { garden, advice } of gardens) {
    for (const action of advice?.actions ?? []) {
      if (seenActions.has(action.id)) continue
      seenActions.add(action.id)
      actionGardenIds[action.id] = garden.id
      actions.push(action)
    }
    for (const alert of advice?.alerts ?? []) {
      if (seenAlerts.has(alert.id)) continue
      seenAlerts.add(alert.id)
      alerts.push(alert)
    }
  }

  return (
    <Suspense>
      <CalendrierPageInner
        initialActions={actions}
        alerts={alerts}
        actionGardenIds={actionGardenIds}
        fallbackGardenId={gardens[0].garden.id}
      />
    </Suspense>
  )
}
