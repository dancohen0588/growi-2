import { View } from 'react-native'

import { Skeleton } from '@/components/ui/states'

/**
 * Silhouette d'une carte d'article — même proportion d'image et mêmes lignes
 * que `PostCard`, pour que rien ne se déplace à l'arrivée du contenu.
 */
export function PostCardSkeleton({ compact = false }: { compact?: boolean }) {
  return (
    <View className="gap-2 rounded-2xl bg-card p-3">
      <View className="w-full overflow-hidden rounded-xl" style={{ aspectRatio: 16 / 9 }}>
        <Skeleton className="h-full w-full" />
      </View>
      <Skeleton className="h-5 w-1/3 rounded-full" />
      <Skeleton className="h-4 w-full" />
      {compact ? null : <Skeleton className="h-4 w-3/4" />}
      <Skeleton className="h-3 w-1/2" />
    </View>
  )
}
