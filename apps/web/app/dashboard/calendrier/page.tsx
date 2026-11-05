import { Suspense } from 'react'
import { actionHorizon } from '@growi/shared'

import { auth } from '@/auth'
import { TrackView } from '@/components/analytics/TrackView'
import { getGardensAdvice } from '@/lib/services/advice.service'
import { getGrimoire } from '@/lib/services/secrets.service'
import { listDoneTodayActions, lunarDayFor } from '@/lib/services/planning.service'
import { getUserTimezone, hasLunarCalendar } from '@/lib/services/user.service'
import { zonedDayIso } from '@/lib/zoned-day'
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
  // Le compte du grimoire (« Mon grimoire · 3 / 24 ») part en même temps que le
  // reste : attendu après le planning, il allongeait chaque chargement. Jamais
  // bloquant — sans lui, le lien dit « Mon grimoire ».
  const grimoireCount = getGrimoire(session.user.id)
    .then(({ discovered, total }) => ({ discovered, total }))
    .catch((error: unknown) => {
      console.error('[calendrier] grimoire illisible', error)
      return null
    })
  const [gardens, doneToday, lunarEnabled, timeZone, grimoireRead] = await Promise.all([
    getGardensAdvice(session.user.id),
    listDoneTodayActions(session.user.id),
    hasLunarCalendar(session.user.id),
    getUserTimezone(session.user.id),
    grimoireCount,
  ])

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

  // `actionHorizon` compare des jours en chaîne `YYYY-MM-DD`, pas des dates.
  const today = new Date().toISOString().slice(0, 10)
  // Les secrets ont leur carte à part : ils ne comptent pas dans les gestes du jour.
  const actionsToday = actions.filter(
    (action) => !action.secret && actionHorizon(action, today) === 'today',
  )

  const grimoire = actions.some((action) => action.secret) ? grimoireRead : null

  // Le jour lunaire se lit dans le jour civil de l'utilisateur, pas en UTC :
  // à 0 h 30 à Paris, c'est déjà le jour suivant qu'il faut annoncer.
  const lunar = lunarEnabled ? lunarDayFor(zonedDayIso(new Date(), timeZone)) : null

  return (
    <Suspense>
      <TrackView
        event="planning_viewed"
        props={{ horizon: 'today', actions_today: actionsToday.length }}
      />
      <CalendrierPageInner
        initialActions={actions}
        initialDoneToday={doneToday}
        alerts={alerts}
        actionGardenIds={actionGardenIds}
        fallbackGardenId={gardens[0].garden.id}
        gardenIds={gardens.map(({ garden }) => garden.id)}
        // Le calendrier réunit tous les jardins : dès que l'un est en pause, la
        // section du jour le dit — sinon l'utilisateur verrait sa liste maigrir
        // sans savoir pourquoi ni comment revenir en arrière.
        clearedToday={gardens.some(({ garden }) => garden.clearedToday)}
        lunar={lunar}
        grimoire={grimoire}
      />
    </Suspense>
  )
}
