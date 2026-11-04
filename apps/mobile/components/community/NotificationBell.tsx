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
export function NotificationBell({ onPhoto = false }: { onPhoto?: boolean }) {
  const router = useRouter()
  const settings = useCommunitySettings()
  const enabled = settings.data?.enabled === true
  const unread = useUnreadCount({ enabled }).data?.unread ?? 0

  if (!enabled) return null

  return (
    <Pressable
      onPress={() => router.navigate('/(tabs)/communaute/notifications')}
      hitSlop={onPhoto ? 0 : 12}
      accessibilityRole="button"
      accessibilityLabel={
        unread > 0 ? `Notifications, ${unread} non lues` : 'Notifications'
      }
      // Posée sur la photo de l'accueil, la cloche nue se perdrait dans le
      // feuillage : elle prend une pastille sombre, à la taille du pouce.
      className={
        onPhoto
          ? 'h-11 w-11 items-center justify-center rounded-full border border-sand/30 bg-forest/60'
          : undefined
      }
    >
      <Bell size={onPhoto ? 22 : 26} color={onPhoto ? '#F9F7E8' : '#1E5631'} />

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
