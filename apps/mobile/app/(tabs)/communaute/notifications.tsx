import { useEffect } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { Heart, MessageCircle, UserPlus } from 'lucide-react-native'
import type { CommunityNotification, NotificationKind } from '@growi/shared'

import { CommunityHeader } from '@/components/community/CommunityHeader'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { formatLogDate } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { notificationRoute } from '@/lib/notifications'
import { useMarkNotificationsRead, useNotifications } from '@/lib/queries/community'

/**
 * Écran 10 — la cloche.
 *
 * Tout est marqué lu à l'ouverture : c'est le geste que fait l'utilisateur en
 * arrivant, et lui demander de cocher vingt lignes pour éteindre un badge
 * serait une corvée sans contrepartie. Les lignes non lues restent
 * distinguées le temps de la consultation.
 */

function KindIcon({ kind }: { kind: NotificationKind }) {
  if (kind === 'follow') return <UserPlus size={20} color="#1E5631" />
  if (kind === 'like') return <Heart size={20} color="#1E5631" fill="#B4DD7F" />
  return <MessageCircle size={20} color="#1E5631" />
}

function NotificationRow({
  notification,
  onPress,
}: {
  notification: CommunityNotification
  onPress: () => void
}) {
  const unread = notification.readAt === null

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={notification.preview}
      className={[
        'flex-row items-center gap-3 rounded-xl p-3',
        unread ? 'bg-lime' : 'bg-card',
      ].join(' ')}
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
    >
      {notification.actor?.avatarUrl ? (
        <Image
          source={notification.actor.avatarUrl}
          style={{ width: 40, height: 40, borderRadius: 20 }}
          contentFit="cover"
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View className="h-10 w-10 items-center justify-center rounded-full bg-sand">
          <KindIcon kind={notification.kind} />
        </View>
      )}

      <View className="flex-1 gap-0.5">
        {/* Le texte est figé à l'écriture : l'acteur peut avoir changé de
            pseudo depuis, ce qui a été annoncé ne se réécrit pas. */}
        <Text className="font-raleway text-secondary text-forest">{notification.preview}</Text>
        <Text className="font-raleway text-caption text-muted-foreground">
          {formatLogDate(notification.createdAt)}
        </Text>
      </View>
    </Pressable>
  )
}

export default function NotificationsScreen() {
  const router = useRouter()
  const notifications = useNotifications()
  const markRead = useMarkNotificationsRead()

  const items = notifications.data?.pages.flatMap((page) => page.items) ?? []
  const hasUnread = items.some((item) => item.readAt === null)

  // Une fois la première page affichée, et une seule fois : relancer à chaque
  // page ferait autant d'écritures que de défilements.
  useEffect(() => {
    if (hasUnread && !markRead.isPending && markRead.isIdle) markRead.mutate()
  }, [hasUnread, markRead])

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <CommunityHeader title="Notifications" parent="/(tabs)/communaute" />

      {notifications.isPending ? (
        <View className="px-4">
          <ListSkeleton count={4} />
        </View>
      ) : notifications.isError ? (
        <ErrorState
          message={errorMessage(notifications.error)}
          onRetry={() => void notifications.refetch()}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 pb-8 gap-2"
          refreshControl={
            <RefreshControl
              refreshing={notifications.isRefetching}
              onRefresh={() => void notifications.refetch()}
              tintColor="#B4DD7F"
            />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (notifications.hasNextPage && !notifications.isFetchingNextPage) {
              void notifications.fetchNextPage()
            }
          }}
          ListEmptyComponent={
            <EmptyState
              emoji="🔔"
              title="Rien de neuf"
              message="Les réactions à tes publications et tes nouveaux abonnés apparaîtront ici."
            />
          }
          renderItem={({ item }) => (
            <NotificationRow
              notification={item}
              onPress={() => {
                // Une cible que cette version de l'app ne reconnaît pas ne fait
                // rien plutôt que d'ouvrir un écran au hasard.
                const route = notificationRoute(item.target)
                if (route) router.push(route)
              }}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}
