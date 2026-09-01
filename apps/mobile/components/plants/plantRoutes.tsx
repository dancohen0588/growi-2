import { useLocalSearchParams, useRouter, type Href } from 'expo-router'

import { DiagnosisScreen } from '@/components/diagnosis/DiagnosisScreen'
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
 * Fiche d'une plante. `editHref` et `diagnoseHref` donnent les chemins **dans
 * la pile courante** — ils diffèrent d'un onglet à l'autre, d'où les
 * paramètres plutôt qu'un préfixe deviné.
 */
export function plantDetailRoute(
  editHref: (plantId: string) => Href,
  diagnoseHref: (plantId: string) => Href,
) {
  return function PlanteDetailScreen() {
    const { plantId } = useLocalSearchParams<{ plantId: string }>()
    const router = useRouter()

    return (
      <PlantDetail
        plantId={plantId}
        onEdit={() => router.push(editHref(plantId))}
        onDiagnose={() => router.push(diagnoseHref(plantId))}
      />
    )
  }
}

/** Diagnostic d'une plante — le même quelle que soit la pile. */
export function plantDiagnosisRoute() {
  return function DiagnosticPlanteScreen() {
    const { plantId } = useLocalSearchParams<{ plantId: string }>()

    return <DiagnosisScreen plantId={plantId} />
  }
}

/**
 * Édition d'une plante.
 *
 * `afterDeleteHref` est la liste vers laquelle revenir après une suppression :
 * la fiche de la plante, juste au-dessous dans la pile, n'existe plus. Elle
 * diffère d'un onglet à l'autre, d'où le paramètre.
 */
export function plantEditorRoute(afterDeleteHref: Href) {
  return function ModifierPlanteScreen() {
    const { plantId } = useLocalSearchParams<{ plantId: string }>()

    return <PlantEditor plantId={plantId} afterDeleteHref={afterDeleteHref} />
  }
}
