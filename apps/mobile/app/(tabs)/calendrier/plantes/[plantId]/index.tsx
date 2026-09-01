import { plantDetailRoute } from '@/components/plants/plantRoutes'

export default plantDetailRoute(
  (id) => `/(tabs)/calendrier/plantes/${id}/modifier`,
  (id) => `/(tabs)/calendrier/plantes/${id}/diagnostic`,
  (id) => `/(tabs)/calendrier/plantes/${id}/discussion`,
)
