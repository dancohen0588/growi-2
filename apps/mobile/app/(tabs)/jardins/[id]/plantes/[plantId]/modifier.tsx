import { useLocalSearchParams } from 'expo-router'

import { PlantEditor } from '@/components/plants/PlantEditor'

/**
 * Édition d'une plante ouverte depuis un jardin.
 *
 * Écrite à la main plutôt que via `plantEditorRoute` : la liste où revenir
 * après une suppression est celle du jardin, qui dépend de son identifiant.
 */
export default function ModifierPlanteScreen() {
  const { id, plantId } = useLocalSearchParams<{ id: string; plantId: string }>()

  return <PlantEditor plantId={plantId} afterDeleteHref={`/(tabs)/jardins/${id}`} />
}
