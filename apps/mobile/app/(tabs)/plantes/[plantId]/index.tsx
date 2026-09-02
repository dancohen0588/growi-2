import { plantDetailRoute } from '@/components/plants/plantRoutes'

export default plantDetailRoute(
  (id) => `/(tabs)/plantes/${id}/modifier`,
  (id) => `/(tabs)/plantes/${id}/diagnostic`,
  (id) => `/(tabs)/plantes/${id}/discussion`,
)
