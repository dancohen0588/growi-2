import { useState } from 'react'
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { Send, ShieldCheck, Sprout } from 'lucide-react-native'
import type { ListingMessage, ListingThreadDetail } from '@growi/shared'
import {
  LISTING_MESSAGE_MAX_LENGTH,
  LISTING_SAFETY_NOTICE,
  LISTING_STATUS_LABELS,
} from '@growi/shared'

import { CommunityHeader } from '@/components/community/CommunityHeader'
import { useToast } from '@/components/ui/Toast'
import { ErrorState, ListSkeleton } from '@/components/ui/states'
import { formatLogDate } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { useSendThreadMessage, useThread, useThreadMessages } from '@/lib/queries/community'

/**
 * Écran 6 — le fil de discussion d'une annonce.
 *
 * L'en-tête est l'annonce elle-même : on discute d'un objet, pas d'une
 * personne, et le fil reste lisible même si l'annonce a été retirée depuis.
 */

function Bubble({ message }: { message: ListingMessage }) {
  return (
    <View className={message.isMine ? 'items-end' : 'items-start'}>
      <View
        className={[
          'max-w-[80%] rounded-xl px-3 py-2',
          message.isMine ? 'bg-lime' : 'bg-card',
        ].join(' ')}
      >
        <Text className="font-raleway text-body text-forest">{message.body}</Text>
      </View>
      <Text className="mt-0.5 font-raleway text-caption text-muted-foreground">
        {formatLogDate(message.createdAt)}
      </Text>
    </View>
  )
}

function ThreadContent({ thread }: { thread: ListingThreadDetail }) {
  const router = useRouter()
  const toast = useToast()

  const messages = useThreadMessages(thread.id)
  const send = useSendThreadMessage(thread.id)
  const [draft, setDraft] = useState('')

  const items = messages.data?.pages.flatMap((page) => page.items) ?? []

  const submit = async () => {
    const body = draft.trim()
    if (!body) return

    try {
      await send.mutateAsync({ body })
      setDraft('')
    } catch (error) {
      toast(errorMessage(error), 'error')
    }
  }

  return (
    <>
      <Pressable
        onPress={() => router.push(`/(tabs)/communaute/bourse/${thread.listingId}`)}
        accessibilityRole="button"
        accessibilityLabel={`Annonce : ${thread.listingTitle}`}
        className="mx-4 mb-2 flex-row items-center gap-3 rounded-xl bg-card p-3"
        style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
      >
        <View className="h-12 w-12 items-center justify-center overflow-hidden rounded-lg bg-sand-dark">
          {thread.listingPhotoUrl ? (
            <Image
              source={thread.listingPhotoUrl}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
              accessibilityIgnoresInvertColors
            />
          ) : (
            <Sprout size={18} color="#1E5631" />
          )}
        </View>
        <View className="flex-1">
          <Text className="font-raleway-medium text-secondary text-forest" numberOfLines={1}>
            {thread.listingTitle}
          </Text>
          <Text className="font-raleway text-caption text-muted-foreground">
            {LISTING_STATUS_LABELS[thread.listingStatus]}
          </Text>
        </View>
      </Pressable>

      {/* La liste est inversée : les messages arrivent du plus récent au plus
          ancien, et le bas de l'écran est le présent. */}
      <FlatList
        data={items}
        inverted
        keyExtractor={(message) => message.id}
        contentContainerClassName="px-4 pb-2 gap-3"
        keyboardShouldPersistTaps="handled"
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (messages.hasNextPage && !messages.isFetchingNextPage) {
            void messages.fetchNextPage()
          }
        }}
        // En liste inversée, le pied est en haut : c'est là que se place le
        // bandeau de prudence, une fois remonté au début de la conversation.
        ListFooterComponent={
          !messages.hasNextPage ? (
            <View className="mt-2 flex-row items-start gap-2 rounded-xl bg-card p-3">
              <ShieldCheck size={18} color="#1E5631" />
              <Text className="flex-1 font-raleway text-caption text-muted-foreground">
                {LISTING_SAFETY_NOTICE}
              </Text>
            </View>
          ) : null
        }
        renderItem={({ item }) => <Bubble message={item} />}
      />

      <View className="flex-row items-end gap-2 border-t border-border px-4 py-2">
        <View className="h-12 flex-1 justify-center rounded-lg border border-input bg-card px-4">
          <TextInput
            className="font-raleway text-body text-forest"
            placeholder="Écris un message…"
            placeholderTextColor="hsl(139 20% 40%)"
            value={draft}
            onChangeText={setDraft}
            maxLength={LISTING_MESSAGE_MAX_LENGTH}
            returnKeyType="send"
            onSubmitEditing={() => void submit()}
            accessibilityLabel="Message"
          />
        </View>

        <Pressable
          onPress={() => void submit()}
          disabled={!draft.trim() || send.isPending}
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

export default function DiscussionScreen() {
  const { threadId } = useLocalSearchParams<{ threadId: string }>()
  const router = useRouter()
  const thread = useThread(threadId ?? '')

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <CommunityHeader
          title={thread.data?.other.handle ?? 'Discussion'}
          parent="/(tabs)/communaute/messages"
        />

        {thread.isPending ? (
          <View className="px-4">
            <ListSkeleton count={3} />
          </View>
        ) : thread.isError ? (
          <ErrorState message={errorMessage(thread.error)} onRetry={() => void thread.refetch()} />
        ) : (
          <ThreadContent thread={thread.data} />
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}
