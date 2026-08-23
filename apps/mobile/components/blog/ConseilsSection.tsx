import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native'
import { useRouter } from 'expo-router'
import { ChevronRight } from 'lucide-react-native'

import { PostCard } from '@/components/blog/PostCard'
import { PostCardSkeleton } from '@/components/blog/PostCardSkeleton'
import { HOME_POST_COUNT, useLatestBlogPosts } from '@/lib/queries/blog'

/**
 * « Conseils du moment » — le carrousel du blog sur l'accueil.
 *
 * En cas d'échec, la section **disparaît** au lieu d'afficher une erreur : le
 * blog est un bonus sur cet écran, et un bandeau rouge au milieu du tableau de
 * bord ferait croire à une panne du jardin. La liste complète, elle, dit
 * franchement ce qui ne va pas — on y est venu pour ça.
 */
export function ConseilsSection() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const query = useLatestBlogPosts()

  // Une carte occupe 72 % de la largeur : la suivante dépasse assez pour
  // qu'on comprenne que ça défile, sans qu'on la lise à moitié.
  const cardWidth = Math.round(width * 0.72)

  if (query.isError || (query.isSuccess && query.data.length === 0)) return null

  const openList = () => router.push('/(tabs)/accueil/conseils')

  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-3 px-4">
        <Text className="font-poppins text-section text-forest">Conseils du moment</Text>

        <Pressable
          onPress={openList}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Voir tous les conseils"
          className="flex-row items-center gap-0.5"
        >
          <Text className="font-raleway-semibold text-secondary text-forest">Tout voir</Text>
          <ChevronRight size={16} color="#1E5631" />
        </Pressable>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-3 px-4"
        // Le défilement s'arrête sur une carte, pas entre deux.
        snapToInterval={cardWidth + 12}
        decelerationRate="fast"
      >
        {query.isPending
          ? Array.from({ length: 3 }, (_, i) => (
              <View key={i} style={{ width: cardWidth }}>
                <PostCardSkeleton compact />
              </View>
            ))
          : query.data.slice(0, HOME_POST_COUNT).map((post) => (
              <View key={post.slug} style={{ width: cardWidth }}>
                <PostCard
                  post={post}
                  compact
                  onPress={() =>
                    router.push({
                      pathname: '/(tabs)/accueil/conseils/[slug]',
                      params: { slug: post.slug },
                    })
                  }
                />
              </View>
            ))}
      </ScrollView>
    </View>
  )
}
