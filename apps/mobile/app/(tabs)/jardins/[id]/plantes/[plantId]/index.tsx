import { useLocalSearchParams, useRouter, type Href } from 'expo-router'

import { PlantDetail } from '@/components/plants/PlantDetail'

/** Fiche ouverte depuis un jardin : édition, diagnostic et discussion restent dans cette pile-là. */
export default function PlanteDetailScreen() {
  const { id, plantId } = useLocalSearchParams<{ id: string; plantId: string }>()
  const router = useRouter()
  const base = `/(tabs)/jardins/${id}/plantes/${plantId}`

  return (
    <PlantDetail
      plantId={plantId}
      onEdit={() => router.push(`${base}/modifier` as Href)}
      onDiagnose={() => router.push(`${base}/diagnostic` as Href)}
      onChat={(query) => router.push(`${base}/discussion${query}` as Href)}
    />
  )
}
