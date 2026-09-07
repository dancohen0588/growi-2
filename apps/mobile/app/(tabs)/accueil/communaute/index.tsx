import { useState } from 'react'
import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft, Plus } from 'lucide-react-native'
import type { CommunityPost, CommunityRadiusKm } from '@growi/shared'
import { COMMUNITY_RADII_KM, COMMUNITY_RADIUS_LABELS } from '@growi/shared'

import { PostCard } from '@/components/community/PostCard'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { EmptyState, ErrorState, ListSkeleton } from '@/components/ui/states'
import { errorMessage } from '@/lib/errors'
import { useCommunitySettings, useFeed, useToggleLike } from '@/lib/queries/community'

/**
 * Écran 1 — le fil « Autour de moi ».
 *
 * L'onglet « Abonnements » viendra avec les abonnements en interface ; en
 * attendant, il n'y a qu'un fil, et le segment n'a rien à segmenter.
 */

/** Pastilles de rayon, dans l'en-tête du fil. */
function RadiusChips({
  value,
  onChange,
}: {
  value: CommunityRadiusKm
  onChange: (km: CommunityRadiusKm) => void
}) {
  return (
    <View className="flex-row gap-2 pb-3">
      {COMMUNITY_RADII_KM.map((km) => {
        const selected = km === value
        return (
          <Pressable
            key={km}
            onPress={() => onChange(km)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`Autour de moi, ${COMMUNITY_RADIUS_LABELS[km]}`}
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
              {COMMUNITY_RADIUS_LABELS[km]}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

export default function CommunauteScreen() {
  const router = useRouter()
  const toast = useToast()
  const settings = useCommunitySettings()

  // Le rayon des réglages sert de point de départ ; les pastilles le changent
  // pour la session sans réécrire la préférence du compte.
  //
  // Le fil n'est demandé qu'une fois ce rayon connu : partir du défaut puis
  // corriger ferait clignoter la pastille sélectionnée, et lancerait deux
  // requêtes pour un compte réglé sur 5 ou 50 km.
  const [radius, setRadius] = useState<CommunityRadiusKm | null>(null)
  const applied = radius ?? settings.data?.radiusKm ?? 20

  const feed = useFeed(applied, { enabled: radius !== null || settings.isSuccess })
  const toggleLike = useToggleLike()

  const posts: CommunityPost[] = feed.data?.pages.flatMap((page) => page.items) ?? []
  const widened = feed.data?.pages[0]?.widened ?? false
  const appliedRadius = feed.data?.pages[0]?.appliedRadiusKm ?? applied

  const openPost = (postId: string) =>
    router.push(`/(tabs)/accueil/communaute/publications/${postId}`)

  const like = (post: CommunityPost) => {
    toggleLike.mutate(
      { postId: post.id, liked: !post.likedByMe },
      { onError: (error) => toast(errorMessage(error), 'error') },
    )
  }

  const header = (
    <View>
      <RadiusChips value={applied} onChange={setRadius} />

      {/* Le fil s'est élargi de lui-même : il faut le dire, sinon on croirait
          qu'un inconnu habite la rue d'à côté. */}
      {widened ? (
        <View className="mb-3 rounded-xl bg-card p-3">
          <Text className="font-raleway text-secondary text-muted-foreground">
            Peu d’activité à {COMMUNITY_RADIUS_LABELS[applied]} — voici ce qui se passe à{' '}
            {appliedRadius} km.
          </Text>
        </View>
      ) : null}
    </View>
  )

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
        <Text className="flex-1 font-poppins-bold text-screen text-forest">Communauté</Text>
      </View>

      {feed.isPending ? (
        <View className="px-4">
          <ListSkeleton count={2} />
        </View>
      ) : feed.isError ? (
        <ErrorState message={errorMessage(feed.error)} onRetry={() => void feed.refetch()} />
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(post) => post.id}
          ListHeaderComponent={header}
          contentContainerClassName="px-4 pb-24 gap-3"
          refreshControl={
            <RefreshControl
              refreshing={feed.isRefetching}
              onRefresh={() => void feed.refetch()}
              tintColor="#B4DD7F"
            />
          }
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) void feed.fetchNextPage()
          }}
          ListEmptyComponent={
            <EmptyState
              emoji="🌱"
              title="Personne n’a encore publié près de chez toi"
              message="Sois le premier — une photo de ton jardin suffit à lancer le voisinage."
              cta={{
                label: 'Publier',
                onPress: () => router.push('/publier'),
              }}
            />
          }
          renderItem={({ item }) => (
            <PostCard post={item} onPress={() => openPost(item.id)} onToggleLike={() => like(item)} />
          )}
        />
      )}

      {/* Action principale en bas à droite : zone du pouce. */}
      {posts.length > 0 ? (
        <View className="absolute bottom-6 right-4">
          <Button
            label="Publier"
            onPress={() => router.push('/publier')}
            icon={<Plus size={20} color="#1E5631" />}
          />
        </View>
      ) : null}
    </SafeAreaView>
  )
}
