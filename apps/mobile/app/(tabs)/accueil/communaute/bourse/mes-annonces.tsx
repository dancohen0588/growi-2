import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'

import { ListingCard } from '@/components/community/ListingCard'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { errorMessage } from '@/lib/errors'
import { useMyListings } from '@/lib/queries/community'

/**
 * Mes annonces, tous statuts.
 *
 * Écran distinct de la bourse : celle-ci est géographique et ne montre que ce
 * qui est disponible, alors qu'on vient ici retrouver une annonce **expirée**
 * pour la prolonger.
 */
export default function MesAnnoncesScreen() {
  const router = useRouter()
  const listings = useMyListings()

  const items = listings.data?.pages.flatMap((page) => page.items) ?? []

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
        <Text className="flex-1 font-poppins-bold text-screen text-forest">Mes annonces</Text>
      </View>

      {listings.isPending ? (
        <View className="px-4">
          <ListSkeleton count={3} />
        </View>
      ) : listings.isError ? (
        <ErrorState
          message={errorMessage(listings.error)}
          onRetry={() => void listings.refetch()}
        />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(listing) => listing.id}
          contentContainerClassName="px-4 pb-8 gap-3"
          refreshControl={
            <RefreshControl
              refreshing={listings.isRefetching}
              onRefresh={() => void listings.refetch()}
              tintColor="#B4DD7F"
            />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (listings.hasNextPage && !listings.isFetchingNextPage) {
              void listings.fetchNextPage()
            }
          }}
          ListEmptyComponent={
            <EmptyState
              emoji="🌱"
              title="Aucune annonce"
              message="Des graines en trop, des boutures, une récolte abondante : le voisinage est preneur."
              cta={{ label: 'Publier une annonce', onPress: () => router.push('/annonce') }}
            />
          }
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() => router.push(`/(tabs)/accueil/communaute/bourse/${item.id}`)}
            />
          )}
        />
      )}
    </SafeAreaView>
  )
}
