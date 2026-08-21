import { useLocalSearchParams } from 'expo-router'

import { PlantEditor } from '@/components/plants/PlantEditor'

export default function ModifierPlanteScreen() {
  const { plantId } = useLocalSearchParams<{ plantId: string }>()

  return <PlantEditor plantId={plantId} />
}
