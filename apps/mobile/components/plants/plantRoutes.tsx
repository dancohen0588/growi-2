import { useLocalSearchParams, useRouter, type Href } from 'expo-router'

import { PlantDetail } from '@/components/plants/PlantDetail'
import { PlantEditor } from '@/components/plants/PlantEditor'

/**
 * La fiche d'une plante s'ouvre depuis plusieurs onglets — l'accueil, le
 * calendrier, les plantes, un jardin. Chacun a sa pile, pour que le retour
 * ramène là d'où l'on vient ; l'écran, lui, doit rester le même.
 *
 * Ces deux fabriques donnent la route d'un onglet en une ligne, au lieu de
 * recopier le même écran quatre fois.
 */

/**
 * Fiche d'une plante. `editHref` donne le chemin d'édition **dans la pile
 * courante** — il diffère d'un onglet à l'autre, d'où le paramètre plutôt
 * qu'un préfixe deviné.
 */
export function plantDetailRoute(editHref: (plantId: string) => Href) {
  return function PlanteDetailScreen() {
    const { plantId } = useLocalSearchParams<{ plantId: string }>()
    const router = useRouter()

    return <PlantDetail plantId={plantId} onEdit={() => router.push(editHref(plantId))} />
  }
}

/** Édition d'une plante — la même quelle que soit la pile. */
export function plantEditorRoute() {
  return function ModifierPlanteScreen() {
    const { plantId } = useLocalSearchParams<{ plantId: string }>()

    return <PlantEditor plantId={plantId} />
  }
}
