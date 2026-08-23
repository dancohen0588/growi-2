import { Pressable, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { Clock } from 'lucide-react-native'
import { BLOG_TAG_LABELS, type BlogPostSummary } from '@growi/shared'

import { formatArticleDate } from '@/lib/dates'

/**
 * Carte d'article, dans les deux formats dont l'app a besoin :
 *
 * - `compact` pour le carrousel de l'accueil, à largeur imposée par l'appelant ;
 * - plein format pour la liste, où la carte occupe toute la largeur.
 *
 * Même hiérarchie que la carte du site : image 16/9, tag, titre, puis date et
 * temps de lecture.
 */
export function PostCard({
  post,
  onPress,
  compact = false,
}: {
  post: BlogPostSummary
  onPress: () => void
  compact?: boolean
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Lire l'article ${post.title}`}
      className="gap-2 overflow-hidden rounded-2xl bg-card p-3"
      style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
    >
      <View
        className="w-full items-center justify-center overflow-hidden rounded-xl bg-sand-dark"
        style={{ aspectRatio: 16 / 9 }}
      >
        {post.coverImage ? (
          <Image
            source={post.coverImage}
            contentFit="cover"
            transition={150}
            style={{ width: '100%', height: '100%' }}
            accessibilityIgnoresInvertColors
            alt={post.coverImageAlt ?? ''}
          />
        ) : (
          <Text className="text-4xl">🌱</Text>
        )}
      </View>

      {post.tags[0] ? (
        <View className="self-start rounded-full bg-lime/30 px-2.5 py-1">
          <Text className="font-raleway-semibold text-caption text-forest">
            {BLOG_TAG_LABELS[post.tags[0]]}
          </Text>
        </View>
      ) : null}

      <Text
        className="font-poppins text-body text-forest"
        numberOfLines={2}
      >
        {post.title}
      </Text>

      {/* L'extrait n'a pas sa place dans le carrousel : la carte y est étroite
          et le titre porte déjà la promesse. */}
      {compact ? null : (
        <Text className="font-raleway text-secondary text-muted-foreground" numberOfLines={3}>
          {post.excerpt}
        </Text>
      )}

      <View className="flex-row items-center gap-2">
        <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
          {formatArticleDate(post.publishedAt)}
        </Text>
        <Text className="text-caption text-muted-foreground">·</Text>
        <View className="flex-row items-center gap-1">
          <Clock size={12} color="hsl(139 20% 40%)" />
          <Text className="font-raleway text-caption text-muted-foreground">
            {post.readingTime} min
          </Text>
        </View>
      </View>
    </Pressable>
  )
}
