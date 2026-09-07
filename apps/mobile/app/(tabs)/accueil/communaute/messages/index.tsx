import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { ChevronLeft, Sprout } from 'lucide-react-native'
import type { ListingThread } from '@growi/shared'

import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { formatLogDate } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { useThreads } from '@/lib/queries/community'

/**
 * Écran 9 — mes discussions.
 *
 * Les deux rôles y sont mêlés : les annonces auxquelles j'ai répondu et
 * celles auxquelles on m'a répondu. Séparer les deux ferait chercher dans
 * deux listes une conversation dont on ne se rappelle que le nom de l'autre.
 */

function ThreadRow({ thread, onPress }: { thread: ListingThread; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Discussion avec ${thread.other.handle} à propos de ${thread.listingTitle}`}
      className="flex-row items-center gap-3 rounded-xl bg-card p-3"
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
    >
      <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-lg bg-sand-dark">
        {thread.listingPhotoUrl ? (
          <Image
            source={thread.listingPhotoUrl}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Sprout size={20} color="#1E5631" />
        )}
      </View>

      <View className="flex-1 gap-0.5">
        <View className="flex-row items-center gap-2">
          <Text
            className={[
              'flex-1 text-body text-forest',
              thread.unread ? 'font-raleway-medium' : 'font-raleway',
            ].join(' ')}
            numberOfLines={1}
          >
            {thread.other.handle}
          </Text>
          {thread.lastMessageAt ? (
            <Text className="font-raleway text-caption text-muted-foreground">
              {formatLogDate(thread.lastMessageAt)}
            </Text>
          ) : null}
        </View>

        <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
          {thread.listingTitle}
        </Text>

        {thread.lastMessage ? (
          <Text
            className={[
              'text-secondary',
              thread.unread ? 'font-raleway-medium text-forest' : 'font-raleway text-muted-foreground',
            ].join(' ')}
            numberOfLines={1}
          >
            {thread.lastMessage}
          </Text>
        ) : null}
      </View>

      {thread.unread ? <View className="h-2.5 w-2.5 rounded-full bg-destructive" /> : null}
    </Pressable>
  )
}

export default function MessagesScreen() {
  const router = useRouter()
  const threads = useThreads()

  const items = threads.data?.pages.flatMap((page) => page.items) ?? []

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-2 px-4 py-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <ChevronLeft size={26} color="#1E5631" />
        </Pressable>
        <Text className="flex-1 font-poppins-bold text-screen text-forest">Messages</Text>
      </View>

      {threads.isPending ? (
        <View className="px-4">
          <ListSkeleton count={4} />
        </View>
      ) : threads.isError ? (
        <ErrorState message={errorMessage(threads.error)} onRetry={() => void threads.refetch()} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(thread) => thread.id}
          contentContainerClassName="px-4 pb-8 gap-2"
          refreshControl={
            <RefreshControl
              refreshing={threads.isRefetching}
              onRefresh={() => void threads.refetch()}
              tintColor="#B4DD7F"
            />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (threads.hasNextPage && !threads.isFetchingNextPage) void threads.fetchNextPage()
          }}
          ListEmptyComponent={
            <EmptyState
              emoji="💬"
              title="Tes échanges apparaîtront ici"
              message="Réponds à une annonce de la bourse, ou publie la tienne."
              cta={{
                label: 'Voir la bourse',
                onPress: () => router.replace('/(tabs)/accueil/communaute/bourse'),
              }}
            />
          }
          renderItem={({ item }) => (
            <ThreadRow
              thread={item}
              onPress={() => router.push(`/(tabs)/accueil/communaute/messages/${item.id}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}
