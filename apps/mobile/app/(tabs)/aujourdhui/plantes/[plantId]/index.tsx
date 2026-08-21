import { useLocalSearchParams, useRouter } from 'expo-router'

import { PlantDetail } from '@/components/plants/PlantDetail'

/** La même fiche que dans l'onglet Jardins, mais dans la pile d'Aujourd'hui. */
export default function PlanteDetailScreen() {
  const { plantId } = useLocalSearchParams<{ plantId: string }>()
  const router = useRouter()

  return (
    <PlantDetail
      plantId={plantId}
      onEdit={() => router.push(`/(tabs)/aujourdhui/plantes/${plantId}/modifier`)}
    />
  )
}
