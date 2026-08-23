import { useCallback, useState } from 'react'
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import { ChevronLeft } from 'lucide-react-native'
import { Pressable } from 'react-native'
import { BLOG_TAG_LABELS, type BlogPostSummary, type BlogTag } from '@growi/shared'

import { PostCard } from '@/components/blog/PostCard'
import { PostCardSkeleton } from '@/components/blog/PostCardSkeleton'
import { TagChips } from '@/components/blog/TagChips'
import { EmptyState, ErrorState } from '@/components/ui/states'
import { errorMessage } from '@/lib/errors'
import { useBlogPosts } from '@/lib/queries/blog'

/**
 * Conseils — la liste des articles.
 *
 * Contrairement au carrousel de l'accueil, cet écran dit franchement ce qui ne
 * va pas : on y est venu pour lire, une section qui s'évapore laisserait
 * devant un écran vide sans explication.
 */
export default function ConseilsScreen() {
  const router = useRouter()
  const [tag, setTag] = useState<BlogTag | undefined>(undefined)
  const [refreshing, setRefreshing] = useState(false)

  const query = useBlogPosts(tag)
  const posts: BlogPostSummary[] = query.data?.pages.flatMap((page) => page.posts) ?? []

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    try {
      await query.refetch()
    } finally {
      setRefreshing(false)
    }
  }, [query])

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-2 px-4 pb-2 pt-1">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          className="h-11 w-11 -ml-2 items-center justify-center"
        >
          <ChevronLeft size={26} color="#1E5631" />
        </Pressable>

        <View className="flex-1">
          <Text className="font-poppins-bold text-screen text-forest">Conseils</Text>
          <Text className="font-raleway text-secondary text-muted-foreground">
            Des gestes concrets, calés sur la saison.
          </Text>
        </View>
      </View>

      <View className="pb-3">
        <TagChips active={tag} onChange={setTag} />
      </View>

      <FlatList
        data={posts}
        keyExtractor={(post) => post.slug}
        contentContainerClassName="gap-3 px-4 pb-8"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B4DD7F" />
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onPress={() =>
              router.push({
                pathname: '/(tabs)/accueil/conseils/[slug]',
                params: { slug: item.slug },
              })
            }
          />
        )}
        onEndReachedThreshold={0.4}
        onEndReached={() => {
          if (query.hasNextPage && !query.isFetchingNextPage) void query.fetchNextPage()
        }}
        ListEmptyComponent={
          query.isPending ? (
            <View className="gap-3">
              {Array.from({ length: 3 }, (_, i) => (
                <PostCardSkeleton key={i} />
              ))}
            </View>
          ) : query.isError ? (
            <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
          ) : (
            <EmptyState
              emoji="🌾"
              title={tag ? 'Rien sur ce thème pour l’instant' : 'Les premiers conseils arrivent'}
              message={
                tag
                  ? `Aucun article sur « ${BLOG_TAG_LABELS[tag]} » pour le moment. Regarde les autres thèmes.`
                  : 'On prépare la première série de conseils de saison. Reviens bientôt 🌱'
              }
              cta={tag ? { label: 'Voir tous les thèmes', onPress: () => setTag(undefined) } : undefined}
            />
          )
        }
        ListFooterComponent={
          query.isFetchingNextPage ? (
            <View className="py-4">
              <ActivityIndicator color="#1E5631" />
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  )
}
