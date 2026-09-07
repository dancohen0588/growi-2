import { Alert, FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import type { BlockedAccount } from '@growi/shared'

import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { errorMessage } from '@/lib/errors'
import { useBlockedAccounts, useUnblock } from '@/lib/queries/community'

/**
 * Comptes bloqués — la contrepartie visible du blocage.
 *
 * Un blocage qu'on ne peut pas relire n'est pas une protection, c'est un
 * piège : on finit par ne plus savoir pourquoi quelqu'un a disparu du fil.
 */

function BlockedRow({
  account,
  onUnblock,
  pending,
}: {
  account: BlockedAccount
  onUnblock: () => void
  pending: boolean
}) {
  return (
    <View className="flex-row items-center gap-3 rounded-xl bg-card p-4">
      <View className="flex-1">
        <Text className="font-raleway-medium text-body text-forest" numberOfLines={1}>
          {account.user.handle}
        </Text>
        {account.user.city ? (
          <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
            {account.user.city}
          </Text>
        ) : null}
      </View>

      <Pressable
        onPress={onUnblock}
        disabled={pending}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Débloquer ${account.user.handle}`}
        // h-11 : la zone tactile fait 44 pt même si le texte est court.
        className="h-11 justify-center rounded-lg border border-forest px-4"
        style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
      >
        <Text className="font-raleway-medium text-secondary text-forest">Débloquer</Text>
      </Pressable>
    </View>
  )
}

export default function ComptesBloquesScreen() {
  const router = useRouter()
  const toast = useToast()
  const blocked = useBlockedAccounts()
  const unblock = useUnblock()

  const confirmUnblock = (account: BlockedAccount) => {
    Alert.alert(
      `Débloquer ${account.user.handle} ?`,
      'Vous verrez de nouveau vos contenus respectifs. Vos abonnements, eux, ne reviennent pas.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Débloquer',
          onPress: async () => {
            try {
              await unblock.mutateAsync(account.user.handle)
              toast('Compte débloqué')
            } catch (error) {
              toast(errorMessage(error), 'error')
            }
          },
        },
      ],
    )
  }

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
        <Text className="font-poppins-bold text-screen text-forest">Comptes bloqués</Text>
      </View>

      {blocked.isPending ? (
        <View className="px-4">
          <ListSkeleton count={3} />
        </View>
      ) : blocked.isError ? (
        <ErrorState message={errorMessage(blocked.error)} onRetry={() => void blocked.refetch()} />
      ) : (
        <FlatList
          data={blocked.data}
          keyExtractor={(item) => item.user.id}
          contentContainerClassName="px-4 pb-8 gap-3"
          refreshControl={
            <RefreshControl
              refreshing={blocked.isRefetching}
              onRefresh={() => void blocked.refetch()}
              tintColor="#B4DD7F"
            />
          }
          ListEmptyComponent={
            <EmptyState
              emoji="🌿"
              title="Personne de bloqué"
              message="Tu peux bloquer un compte depuis son profil : il ne verra plus tes contenus, et tu ne verras plus les siens."
            />
          }
          renderItem={({ item }) => (
            <BlockedRow
              account={item}
              pending={unblock.isPending}
              onUnblock={() => confirmUnblock(item)}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}
