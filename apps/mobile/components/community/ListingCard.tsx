import { Pressable, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Leaf, Scissors, ShoppingBasket, Shovel, Sprout } from 'lucide-react-native'
import type { Listing, ListingCategory } from '@growi/shared'
import {
  LISTING_CATEGORY_ICONS,
  LISTING_CATEGORY_LABELS,
  LISTING_KIND_LABELS,
  LISTING_STATUS_LABELS,
} from '@growi/shared'

/**
 * Une annonce dans la bourse.
 *
 * Vignette à gauche, titre et repères à droite : contrairement au fil des
 * publications, on parcourt la bourse pour lire des intitulés, pas pour
 * regarder des photos.
 */

/**
 * Le nom d'icône partagé est relié ici à son composant `lucide-react-native`.
 * Le web fera de même avec `lucide-react` — c'est ce qui garantit que les
 * graines portent le même signe des deux côtés.
 */
const ICONS: Record<string, typeof Sprout> = {
  sprout: Sprout,
  leaf: Leaf,
  scissors: Scissors,
  'shopping-basket': ShoppingBasket,
  shovel: Shovel,
}

function CategoryIcon({ category }: { category: ListingCategory }) {
  const Icon = ICONS[LISTING_CATEGORY_ICONS[category]] ?? Leaf
  return <Icon size={18} color="#1E5631" />
}

export interface ListingCardProps {
  listing: Listing
  onPress: () => void
}

export function ListingCard({ listing, onPress }: ListingCardProps) {
  // `active` est l'état normal : l'afficher en badge n'apprendrait rien.
  const statusBadge = listing.status !== 'active' ? LISTING_STATUS_LABELS[listing.status] : null

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${LISTING_KIND_LABELS[listing.kind]} : ${listing.title}`}
      className="flex-row gap-3 rounded-xl bg-card p-3"
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
    >
      <View className="h-20 w-20 items-center justify-center overflow-hidden rounded-lg bg-sand-dark">
        {listing.photoUrl ? (
          <Image
            source={listing.photoUrl}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            transition={150}
            recyclingKey={listing.id}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <CategoryIcon category={listing.category} />
        )}
      </View>

      <View className="flex-1 gap-1">
        <View className="flex-row items-center gap-2">
          <View className="rounded-lg bg-lime px-2 py-0.5">
            <Text className="font-raleway-medium text-caption text-forest">
              {LISTING_KIND_LABELS[listing.kind]}
            </Text>
          </View>
          {statusBadge ? (
            <View className="rounded-lg bg-sand-dark px-2 py-0.5">
              <Text className="font-raleway-medium text-caption text-muted-foreground">
                {statusBadge}
              </Text>
            </View>
          ) : null}
        </View>

        <Text className="font-raleway-medium text-body text-forest" numberOfLines={2}>
          {listing.title}
        </Text>

        <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
          {[
            LISTING_CATEGORY_LABELS[listing.category],
            listing.quantity,
            listing.author.distanceLabel,
          ]
            .filter(Boolean)
            .join(' · ')}
        </Text>
      </View>
    </Pressable>
  )
}
