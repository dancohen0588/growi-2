import { useState } from 'react'
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ChevronLeft, Heart, Leaf, MoreHorizontal, Send } from 'lucide-react-native'
import type { CommunityComment, CommunityPostDetail } from '@growi/shared'
import { COMMENT_BODY_MAX_LENGTH } from '@growi/shared'

import { useToast } from '@/components/ui/Toast'
import { ErrorState, ListSkeleton } from '@/components/ui/states'
import { formatLogDate } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import {
  useAddComment,
  useComments,
  useCommunityPost,
  useDeleteComment,
  useDeletePost,
  useToggleLike,
} from '@/lib/queries/community'

/**
 * Écran 2 — le détail d'une publication.
 *
 * Les photos défilent horizontalement, le texte suit, puis les commentaires à
 * plat. Le champ de saisie reste collé au clavier : commenter est la raison
 * d'être de cet écran.
 */

function CommentRow({
  comment,
  onDelete,
}: {
  comment: CommunityComment
  onDelete: () => void
}) {
  return (
    <View className="flex-row gap-3 rounded-xl bg-card p-3">
      <View className="flex-1 gap-0.5">
        <Text className="font-raleway-medium text-secondary text-forest">
          {comment.author.handle}
          <Text className="font-raleway text-caption text-muted-foreground">
            {'  '}
            {formatLogDate(comment.createdAt)}
          </Text>
        </Text>
        <Text className="font-raleway text-body text-forest">{comment.body}</Text>
      </View>

      {comment.canDelete ? (
        <Pressable
          onPress={onDelete}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Supprimer ce commentaire"
        >
          <MoreHorizontal size={20} color="hsl(139 20% 40%)" />
        </Pressable>
      ) : null}
    </View>
  )
}

/** Monté une fois la publication chargée. */
function PostContent({ post }: { post: CommunityPostDetail }) {
  const router = useRouter()
  const toast = useToast()
  const { width } = useWindowDimensions()

  const comments = useComments(post.id)
  const addComment = useAddComment(post.id)
  const deleteComment = useDeleteComment(post.id)
  const deletePost = useDeletePost()
  const toggleLike = useToggleLike()

  const [draft, setDraft] = useState('')

  const rows = comments.data?.pages.flatMap((page) => page.items) ?? []

  const send = async () => {
    const body = draft.trim()
    if (!body) return

    try {
      await addComment.mutateAsync({ body })
      setDraft('')
    } catch (error) {
      toast(errorMessage(error), 'error')
    }
  }

  const confirmDeletePost = () => {
    Alert.alert('Supprimer cette publication ?', 'Elle disparaîtra du fil, avec ses photos.', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: async () => {
          try {
            await deletePost.mutateAsync(post.id)
            toast('Publication supprimée')
            router.back()
          } catch (error) {
            toast(errorMessage(error), 'error')
          }
        },
      },
    ])
  }

  const confirmDeleteComment = (comment: CommunityComment) => {
    Alert.alert('Supprimer ce commentaire ?', '', [
      { text: 'Annuler', style: 'cancel' },
      {
        text: 'Supprimer',
        style: 'destructive',
        onPress: () => {
          deleteComment.mutate(comment.id, {
            onError: (error) => toast(errorMessage(error), 'error'),
          })
        },
      },
    ])
  }

  const header = (
    <View className="gap-3 pb-3">
      {/* Carrousel : une photo par page, pas de miniatures — quatre au plus. */}
      {post.photos.length > 0 ? (
        <FlatList
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          data={post.photos}
          keyExtractor={(url) => url}
          renderItem={({ item }) => (
            <View className="bg-sand-dark" style={{ width, height: width }}>
              <Image
                source={item}
                style={{ width: '100%', height: '100%' }}
                contentFit="cover"
                transition={200}
                accessibilityIgnoresInvertColors
              />
            </View>
          )}
        />
      ) : null}

      <View className="gap-3 px-4">
        <View className="flex-row items-center gap-3">
          <View className="flex-1">
            <Text className="font-raleway-medium text-body text-forest">
              {post.author.handle}
            </Text>
            <Text className="font-raleway text-caption text-muted-foreground">
              {[post.author.distanceLabel, formatLogDate(post.createdAt)]
                .filter(Boolean)
                .join(' · ')}
            </Text>
          </View>

          <Pressable
            onPress={() =>
              toggleLike.mutate(
                { postId: post.id, liked: !post.likedByMe },
                { onError: (error) => toast(errorMessage(error), 'error') },
              )
            }
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={post.likedByMe ? 'Retirer mon cœur' : 'Aimer'}
            className="h-11 flex-row items-center gap-1.5"
          >
            <Heart
              size={24}
              color={post.likedByMe ? '#1E5631' : 'hsl(139 20% 40%)'}
              fill={post.likedByMe ? '#B4DD7F' : 'transparent'}
            />
            <Text className="font-raleway text-body text-muted-foreground">{post.likeCount}</Text>
          </Pressable>
        </View>

        {post.plantLabel ? (
          <View className="flex-row items-center gap-1.5 self-start rounded-lg bg-lime px-2 py-1">
            <Leaf size={14} color="#1E5631" />
            <Text className="font-raleway-medium text-caption text-forest">
              {post.plantLabel}
            </Text>
          </View>
        ) : null}

        {post.body ? (
          <Text className="font-raleway text-body text-forest">{post.body}</Text>
        ) : null}

        {post.isMine ? (
          <Pressable onPress={confirmDeletePost} hitSlop={8} className="self-start py-2">
            <Text className="font-raleway text-caption text-destructive underline">
              Supprimer ma publication
            </Text>
          </Pressable>
        ) : null}

        <Text className="font-poppins text-section text-forest">
          {post.commentCount > 0
            ? `${post.commentCount} commentaire${post.commentCount > 1 ? 's' : ''}`
            : 'Commentaires'}
        </Text>
      </View>
    </View>
  )

  return (
    <>
      {/* Pas de marge horizontale sur le conteneur : les photos sont pleine
          largeur, et ce sont les autres blocs qui portent leur px-4. */}
      <FlatList
        data={rows}
        keyExtractor={(comment) => comment.id}
        ListHeaderComponent={header}
        contentContainerClassName="pb-4 gap-2"
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (comments.hasNextPage && !comments.isFetchingNextPage) {
            void comments.fetchNextPage()
          }
        }}
        ListEmptyComponent={
          <Text className="px-4 font-raleway text-secondary text-muted-foreground">
            Personne n’a encore réagi — dis-lui ce que tu en penses 🌿
          </Text>
        }
        renderItem={({ item }) => (
          <View className="px-4">
            <CommentRow comment={item} onDelete={() => confirmDeleteComment(item)} />
          </View>
        )}
      />

      <View className="flex-row items-end gap-2 border-t border-border px-4 py-2">
        <View className="h-12 flex-1 justify-center rounded-lg border border-input bg-card px-4">
          <TextInput
            className="font-raleway text-body text-forest"
            placeholder="Écris un commentaire…"
            placeholderTextColor="hsl(139 20% 40%)"
            value={draft}
            onChangeText={setDraft}
            maxLength={COMMENT_BODY_MAX_LENGTH}
            returnKeyType="send"
            onSubmitEditing={() => void send()}
            accessibilityLabel="Commentaire"
          />
        </View>

        <Pressable
          onPress={() => void send()}
          disabled={!draft.trim() || addComment.isPending}
          accessibilityRole="button"
          accessibilityLabel="Envoyer"
          className={[
            'h-12 w-12 items-center justify-center rounded-lg',
            draft.trim() ? 'bg-lime' : 'bg-sand-dark',
          ].join(' ')}
          style={({ pressed }) => (pressed ? { transform: [{ scale: 0.98 }] } : null)}
        >
          <Send size={20} color="#1E5631" />
        </Pressable>
      </View>
    </>
  )
}

export default function PublicationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const post = useCommunityPost(id ?? '')

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="flex-row items-center gap-2 px-4 py-3">
          <Pressable
            onPress={() => router.back()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Retour"
          >
            <ChevronLeft size={26} color="#1E5631" />
          </Pressable>
          <Text className="flex-1 font-poppins-bold text-screen text-forest">Publication</Text>
        </View>

        {post.isPending ? (
          <View className="px-4">
            <ListSkeleton count={2} />
          </View>
        ) : post.isError ? (
          <ErrorState message={errorMessage(post.error)} onRetry={() => void post.refetch()} />
        ) : (
          <PostContent post={post.data} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
