import { useEffect, useState } from 'react'
import { AccessibilityInfo } from 'react-native'

/**
 * Le réglage système « Réduire les animations » est-il actif ?
 *
 * On répond `false` tant que la lecture n'a pas abouti : la valeur arrive en un
 * tour de boucle, et un premier rendu animé est moins gênant qu'un écran qui
 * attendrait la réponse pour s'afficher.
 *
 * Le réglage peut changer pendant que l'app tourne (l'utilisateur va dans les
 * Réglages et revient), d'où l'abonnement.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)

  useEffect(() => {
    let alive = true

    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      if (alive) setReduced(value)
    })

    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced)

    return () => {
      alive = false
      subscription.remove()
    }
  }, [])

  return reduced
}
