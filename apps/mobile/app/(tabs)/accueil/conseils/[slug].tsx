import { Pressable, Share, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft, Share2 } from 'lucide-react-native'

import { ArticleView } from '@/components/blog/ArticleView'
import { PostCardSkeleton } from '@/components/blog/PostCardSkeleton'
import { ErrorState } from '@/components/ui/states'
import { WEB_BASE_URL } from '@/lib/api'
import { errorMessage } from '@/lib/errors'
import { useBlogPost } from '@/lib/queries/blog'

/**
 * Un article.
 *
 * L'en-tête est natif — retour et partage doivent rester accessibles pendant
 * la lecture — et tout le reste vit dans la WebView, en un seul défilement.
 */
export default function ArticleScreen() {
  const router = useRouter()
  const { slug } = useLocalSearchParams<{ slug: string }>()
  const query = useBlogPost(slug ?? '')

  /**
   * On partage l'**URL du site**, pas un lien profond : le destinataire n'a
   * probablement pas l'app, et la page web s'ouvre pour tout le monde.
   */
  const share = () => {
    const url = `${WEB_BASE_URL}/blog/${slug}`
    void Share.share({ message: query.data ? `${query.data.title}\n${url}` : url, url })
  }

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-2 px-2 pb-1">
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Retour"
          className="h-11 w-11 items-center justify-center"
        >
          <ChevronLeft size={26} color="#1E5631" />
        </Pressable>

        <Text className="flex-1 font-poppins text-body text-forest" numberOfLines={1}>
          {query.data?.title ?? 'Conseils'}
        </Text>

        <Pressable
          onPress={share}
          hitSlop={8}
          disabled={!slug}
          accessibilityRole="button"
          accessibilityLabel="Partager l'article"
          className="h-11 w-11 items-center justify-center"
        >
          <Share2 size={22} color="#1E5631" />
        </Pressable>
      </View>

      {query.isPending ? (
        <View className="gap-3 px-4 pt-2">
          <PostCardSkeleton />
          <PostCardSkeleton />
        </View>
      ) : query.isError ? (
        <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      ) : (
        <ArticleView post={query.data} />
      )}
    </SafeAreaView>
  )
}
