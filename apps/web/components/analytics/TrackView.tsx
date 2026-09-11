'use client'

import type { GrowiEventName, GrowiEventProps } from '@growi/shared'
import { useEffect, useRef } from 'react'

import { useTrack } from '@/lib/analytics/client'

/**
 * Émet un événement du catalogue à l'affichage d'un écran.
 *
 * La plupart des pages du dashboard sont rendues **côté serveur** : elles ne
 * peuvent pas appeler `useTrack()`, et il serait absurde de les passer client
 * pour une ligne de mesure. Ce composant-là est le morceau client minimal
 * qu'on y dépose, avec les valeurs déjà connues du serveur.
 *
 * ```tsx
 * <TrackView event="planning_viewed" props={{ horizon: 'today', actions_today: 5 }} />
 * ```
 *
 * L'émission est **unique par clé** : un rendu de plus ne compte pas une vue
 * de plus.
 */
export function TrackView<N extends GrowiEventName>({
  event,
  props,
  dedupeKey,
}: {
  event: N
  props: GrowiEventProps<N>
  /** Ce qui distingue deux vues — l'identifiant de la fiche, le slug. */
  dedupeKey?: string
}) {
  const track = useTrack()
  const sent = useRef<string | null>(null)

  useEffect(() => {
    const key = dedupeKey ?? event
    if (sent.current === key) return
    sent.current = key
    track(event, props)
    // `props` est un objet littéral, différent à chaque rendu : le dédoublonnage
    // se fait sur la clé, pas sur son identité.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dedupeKey, event, track])

  return null
}
