import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { Plus } from 'lucide-react-native'
import type { ListingCategory, ListingKind } from '@growi/shared'
import {
  LISTING_CATEGORIES,
  LISTING_CATEGORY_LABELS,
  LISTING_KINDS,
  LISTING_KIND_LABELS,
} from '@growi/shared'

import { CommunityHeader } from '@/components/community/CommunityHeader'
import { ListingCard } from '@/components/community/ListingCard'
import { Button } from '@/components/ui/Button'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { errorMessage } from '@/lib/errors'
import { useListings } from '@/lib/queries/community'

/**
 * Écran 4 — la bourse aux graines.
 *
 * Deux filtres : le type d'annonce en segment, la catégorie en pastilles
 * défilantes. Cinq catégories ne tiennent pas sur la largeur d'un iPhone SE,
 * d'où le défilement horizontal — le seul de l'app avec les carrousels.
 */

/** Pastille de filtre, réutilisée par les deux rangées. */
function Chip({
  label,
  selected,
  onPress,
}: {
  label: string
  selected: boolean
  onPress: () => void
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      // h-11 : la pastille fait aussi office de zone tactile (44 pt).
      className={[
        'h-11 justify-center rounded-lg border px-4',
        selected ? 'border-forest bg-lime' : 'border-input bg-card',
      ].join(' ')}
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
    >
      <Text
        className={[
          'font-raleway-medium text-secondary',
          selected ? 'text-forest' : 'text-muted-foreground',
        ].join(' ')}
      >
        {label}
      </Text>
    </Pressable>
  )
}

export default function BourseScreen() {
  const router = useRouter()

  const [kind, setKind] = useState<ListingKind | null>(null)
  const [category, setCategory] = useState<ListingCategory | null>(null)

  const listings = useListings({
    kind: kind ?? undefined,
    category: category ?? undefined,
  })

  const items = listings.data?.pages.flatMap((page) => page.items) ?? []

  const header = (
    <View className="gap-2 pb-3">
      <View className="flex-row flex-wrap gap-2">
        <Chip label="Tout" selected={kind === null} onPress={() => setKind(null)} />
        {LISTING_KINDS.map((value) => (
          <Chip
            key={value}
            label={LISTING_KIND_LABELS[value]}
            selected={kind === value}
            onPress={() => setKind(value)}
          />
        ))}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: 8 }}
      >
        <Chip
          label="Toutes"
          selected={category === null}
          onPress={() => setCategory(null)}
        />
        {LISTING_CATEGORIES.map((value) => (
          <Chip
            key={value}
            label={LISTING_CATEGORY_LABELS[value]}
            selected={category === value}
            onPress={() => setCategory(value)}
          />
        ))}
      </ScrollView>
    </View>
  )

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <CommunityHeader title="Bourse" parent="/(tabs)/communaute">
        <Pressable
          onPress={() => router.push('/(tabs)/communaute/bourse/mes-annonces')}
          hitSlop={8}
          accessibilityRole="button"
        >
          <Text className="font-raleway-medium text-secondary text-forest">Mes annonces</Text>
        </Pressable>
      </CommunityHeader>

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
          className="flex-1"
          data={items}
          keyExtractor={(listing) => listing.id}
          ListHeaderComponent={header}
          contentContainerClassName="px-4 pb-4 gap-3"
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
              emoji="🌻"
              title="Rien dans ta bourse pour l’instant"
              message="Publie la première annonce de ton quartier — des graines en trop suffisent."
              cta={{
                label: 'Publier une annonce',
                onPress: () => router.push('/annonce'),
              }}
            />
          }
          renderItem={({ item }) => (
            <ListingCard
              listing={item}
              onPress={() => router.push(`/(tabs)/communaute/bourse/${item.id}`)}
            />
          )}
        />
      )}

      {/* Barre d'action en bas, dans le flux — comme « Mes plantes ».
          Elle était en `absolute` : `Button` est `fullWidth` par défaut, et son
          `w-full` se résolvait alors sur la largeur de l'écran au lieu de celle
          d'un conteneur qui n'en avait pas, débordant à gauche. */}
      {items.length > 0 ? (
        <View className="px-4 pb-4 pt-2">
          <Button
            label="Publier"
            onPress={() => router.push('/annonce')}
            icon={<Plus size={20} color="#1E5631" />}
          />
        </View>
      ) : null}
    </SafeAreaView>
  )
}
