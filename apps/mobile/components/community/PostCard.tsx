import { Pressable, Text, View, useWindowDimensions } from 'react-native'
import { Image } from 'expo-image'
import { Heart, Leaf, MessageCircle } from 'lucide-react-native'
import type { CommunityPost } from '@growi/shared'

import { formatLogDate } from '@/lib/dates'

/**
 * Une publication dans le fil.
 *
 * La photo est le sujet : elle occupe toute la largeur, en carré, et le texte
 * vient après. Un fil de jardin se parcourt à l'image.
 */

export interface PostCardProps {
  post: CommunityPost
  onPress: () => void
  onToggleLike: () => void
}

/** Initiale du pseudo, quand le compte n'a pas de photo. */
function Avatar({ post }: { post: CommunityPost }) {
  if (post.author.avatarUrl) {
    return (
      <Image
        source={post.author.avatarUrl}
        style={{ width: 36, height: 36, borderRadius: 18 }}
        contentFit="cover"
        transition={150}
        accessibilityIgnoresInvertColors
      />
    )
  }

  return (
    <View
      className="h-9 w-9 items-center justify-center rounded-full"
      style={{ backgroundColor: post.author.avatarColor ?? '#B4DD7F' }}
    >
      <Text className="font-poppins-bold text-body text-forest">
        {post.author.handle.slice(0, 1).toUpperCase()}
      </Text>
    </View>
  )
}

export function PostCard({ post, onPress, onToggleLike }: PostCardProps) {
  // Photo carrée pleine largeur : la largeur de l'écran moins les marges.
  const { width } = useWindowDimensions()
  const photoSize = width - 32

  return (
    <View className="overflow-hidden rounded-xl bg-card">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`Publication de ${post.author.handle}`}
        style={({ pressed }) => (pressed ? { opacity: 0.95 } : null)}
      >
        <View className="flex-row items-center gap-3 p-3">
          <Avatar post={post} />
          <View className="flex-1">
            <Text className="font-raleway-medium text-body text-forest" numberOfLines={1}>
              {post.author.handle}
            </Text>
            <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
              {[post.author.distanceLabel, formatLogDate(post.createdAt)]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>
        </View>

        {/* Le fond `sand-dark` tient la place pendant le chargement : sans lui,
            le fil sautille au fur et à mesure que les photos arrivent. */}
        {post.photos[0] ? (
          <View className="bg-sand-dark" style={{ width: photoSize, height: photoSize }}>
            <Image
              source={post.photos[0]}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              transition={200}
              recyclingKey={post.id}
              accessibilityIgnoresInvertColors
            />
          </View>
        ) : null}

        {/* Plusieurs photos : on annonce le nombre plutôt que de les empiler.
            Le carrousel est sur le détail. */}
        {post.photos.length > 1 ? (
          <View className="absolute right-3 top-16 rounded-lg bg-forest/80 px-2 py-1">
            <Text className="font-raleway text-caption text-sand">
              1/{post.photos.length}
            </Text>
          </View>
        ) : null}

        <View className="gap-2 p-3">
          {post.plantLabel ? (
            <View className="flex-row items-center gap-1.5 self-start rounded-lg bg-lime px-2 py-1">
              <Leaf size={14} color="#1E5631" />
              <Text className="font-raleway-medium text-caption text-forest">
                {post.plantLabel}
              </Text>
            </View>
          ) : null}

          {post.body ? (
            <Text className="font-raleway text-body text-forest" numberOfLines={4}>
              {post.body}
            </Text>
          ) : null}
        </View>
      </Pressable>

      <View className="flex-row items-center gap-4 px-3 pb-3">
        <Pressable
          onPress={onToggleLike}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={post.likedByMe ? 'Retirer mon cœur' : 'Aimer'}
          accessibilityState={{ selected: Boolean(post.likedByMe) }}
          className="h-11 flex-row items-center gap-1.5"
        >
          <Heart
            size={22}
            color={post.likedByMe ? '#1E5631' : 'hsl(139 20% 40%)'}
            fill={post.likedByMe ? '#B4DD7F' : 'transparent'}
          />
          <Text className="font-raleway text-secondary text-muted-foreground">
            {post.likeCount}
          </Text>
        </Pressable>

        <Pressable
          onPress={onPress}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Voir les commentaires"
          className="h-11 flex-row items-center gap-1.5"
        >
          <MessageCircle size={22} color="hsl(139 20% 40%)" />
          <Text className="font-raleway text-secondary text-muted-foreground">
            {post.commentCount}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}
