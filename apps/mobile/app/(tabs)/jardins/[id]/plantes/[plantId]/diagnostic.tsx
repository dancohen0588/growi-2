import { useLocalSearchParams, useRouter, type Href } from 'expo-router'

import { DiagnosisScreen } from '@/components/diagnosis/DiagnosisScreen'

/**
 * Diagnostic ouvert depuis un jardin.
 *
 * Écrit à la main plutôt qu'avec `plantDiagnosisRoute` : le chemin du fil
 * dépend du jardin, et fabriquer le composant dans le corps de celui-ci en
 * créerait un nouveau à chaque rendu — l'écran se remonterait, perdant la
 * photo choisie et le diagnostic affiché.
 */
export default function DiagnosticPlanteJardinScreen() {
  const { id, plantId } = useLocalSearchParams<{ id: string; plantId: string }>()
  const router = useRouter()

  return (
    <DiagnosisScreen
      plantId={plantId}
      onChat={(query) =>
        router.push(`/(tabs)/jardins/${id}/plantes/${plantId}/discussion${query}` as Href)
      }
    />
  )
}
