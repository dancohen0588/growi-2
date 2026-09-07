import { Pressable, Text, View } from 'react-native'
import { useRouter } from 'expo-router'
import { Bell } from 'lucide-react-native'

import { useCommunitySettings, useUnreadCount } from '@/lib/queries/community'

/**
 * La cloche de l'en-tête de l'accueil.
 *
 * Rien tant que le profil public n'est pas activé : une cloche qui ne sonnera
 * jamais n'est qu'un bouton de plus. Le badge s'arrête à 9+ — au-delà, le
 * chiffre exact ne change plus rien à ce qu'on va faire.
 */
export function NotificationBell() {
  const router = useRouter()
  const settings = useCommunitySettings()
  const enabled = settings.data?.enabled === true
  const unread = useUnreadCount({ enabled }).data?.unread ?? 0

  if (!enabled) return null

  return (
    <Pressable
      onPress={() => router.navigate('/(tabs)/communaute/notifications')}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'
      }
    >
      <Bell size={26} color="#1E5631" />

      {unread > 0 ? (
        <View className="absolute -right-1.5 -top-1 min-w-[18px] items-center justify-center rounded-full bg-destructive px-1">
          <Text className="font-raleway-medium text-[11px] text-sand">
            {unread > 9 ? '9+' : unread}
          </Text>
        </View>
      ) : null}
    </Pressable>
  )
}
