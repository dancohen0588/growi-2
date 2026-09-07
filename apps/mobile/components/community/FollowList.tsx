import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import type { CommunityUser } from '@growi/shared'

import { CommunityHeader } from '@/components/community/CommunityHeader'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { errorMessage } from '@/lib/errors'
import { useFollows } from '@/lib/queries/community'

/**
 * Abonnés ou abonnements d'un compte.
 *
 * Un seul composant pour les deux écrans : ils ne diffèrent que par leur titre
 * et par la direction demandée au serveur. Les comptes bloqués et ceux qui ont
 * quitté la communauté en sont déjà écartés côté service — une liste de
 * profils ne doit pas mener sur des 404.
 */

export interface FollowListProps {
  handle: string
  direction: 'followers' | 'following'
}

function Row({ user, onPress }: { user: CommunityUser; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Profil de ${user.handle}`}
      className="flex-row items-center gap-3 rounded-xl bg-card p-3"
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
    >
      {user.avatarUrl ? (
        <Image
          source={user.avatarUrl}
          style={{ width: 44, height: 44, borderRadius: 22 }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          className="h-11 w-11 items-center justify-center rounded-full"
          style={{ backgroundColor: user.avatarColor ?? '#B4DD7F' }}
        >
          <Text className="font-poppins-bold text-body text-forest">
            {user.handle.slice(0, 1).toUpperCase()}
          </Text>
        </View>
      )}

      <View className="flex-1">
        <Text className="font-raleway-medium text-body text-forest" numberOfLines={1}>
          {user.handle}
        </Text>
        {user.city || user.distanceLabel ? (
          <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
            {[user.city, user.distanceLabel].filter(Boolean).join(' · ')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  )
}

export function FollowList({ handle, direction }: FollowListProps) {
  const router = useRouter()
  const follows = useFollows(handle, direction)

  const items = follows.data?.pages.flatMap((page) => page.items) ?? []
  const title = direction === 'followers' ? 'Abonnés' : 'Abonnements'

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      {/* Le parent est le profil concerné, pas le fil : ces deux listes
          n'existent que rapportées à quelqu'un. */}
      <CommunityHeader title={title} parent={`/(tabs)/communaute/u/${handle}`} />

      {follows.isPending ? (
        <View className="px-4">
          <ListSkeleton count={4} />
        </View>
      ) : follows.isError ? (
        <ErrorState
          message={errorMessage(follows.error)}
          onRetry={() => void follows.refetch()}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(user) => user.id}
          contentContainerClassName="px-4 pb-8 gap-2"
          refreshControl={
            <RefreshControl
              refreshing={follows.isRefetching}
              onRefresh={() => void follows.refetch()}
              tintColor="#B4DD7F"
            />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (follows.hasNextPage && !follows.isFetchingNextPage) void follows.fetchNextPage()
          }}
          ListEmptyComponent={
            <EmptyState
              emoji="🌿"
              title={direction === 'followers' ? 'Aucun abonné' : 'Aucun abonnement'}
              message={
                direction === 'followers'
                  ? 'Publier une photo de son jardin est la meilleure façon de se faire connaître du voisinage.'
                  : 'Suis les jardiniers du coin pour retrouver leurs publications ici.'
              }
            />
          }
          renderItem={({ item }) => (
            <Row
              user={item}
              onPress={() => router.push(`/(tabs)/communaute/u/${item.handle}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}
