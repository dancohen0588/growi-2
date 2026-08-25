import { useLocalSearchParams, useRouter } from 'expo-router'

import { PlantDetail } from '@/components/plants/PlantDetail'

/** Fiche ouverte depuis un jardin : édition et diagnostic restent dans cette pile-là. */
export default function PlanteDetailScreen() {
  const { id, plantId } = useLocalSearchParams<{ id: string; plantId: string }>()
  const router = useRouter()

  return (
    <PlantDetail
      plantId={plantId}
      onEdit={() => router.push(`/(tabs)/jardins/${id}/plantes/${plantId}/modifier`)}
      onDiagnose={() => router.push(`/(tabs)/jardins/${id}/plantes/${plantId}/diagnostic`)}
    />
  )
}
