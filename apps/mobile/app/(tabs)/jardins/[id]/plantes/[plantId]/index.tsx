import { useLocalSearchParams, useRouter } from 'expo-router'

import { PlantDetail } from '@/components/plants/PlantDetail'

/** Fiche ouverte depuis un jardin : l'édition reste dans cette pile-là. */
export default function PlanteDetailScreen() {
  const { id, plantId } = useLocalSearchParams<{ id: string; plantId: string }>()
  const router = useRouter()

  return (
    <PlantDetail
      plantId={plantId}
      onEdit={() => router.push(`/(tabs)/jardins/${id}/plantes/${plantId}/modifier`)}
    />
  )
}
