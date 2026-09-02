import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  ActivityIndicator,
  Alert,
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { useRouter } from 'expo-router'
import { ChevronLeft, ImagePlus, RefreshCw, SendHorizontal, X } from 'lucide-react-native'
import {
  CHAT_MESSAGE_MAX_LENGTH,
  type ChatMessage,
  type ConversationKind,
  type OpenConversationInput,
} from '@growi/shared'

import { MessageText } from '@/components/chat/MessageText'
import { ProposalCard } from '@/components/chat/ProposalCard'
import { ErrorState, ListSkeleton } from '@/components/ui/states'
import { formatDueDate } from '@/lib/dates'
import { errorMessage } from '@/lib/errors'
import { PermissionDeniedError, pickPhoto, takePhoto, type Photo } from '@/lib/photo'
import { useChatThread } from '@/lib/queries/chat'

/**
 * Le fil de discussion avec Growi.
 *
 * Toujours ancré : on n'y arrive pas par un onglet mais depuis une plante, un
 * diagnostic ou une tâche. C'est ce qui permet à l'agent de répondre sur *ce*
 * cas-là, et à l'écran d'ouvrir sur des suggestions qui ont un sens.
 */

/** Trois amorces par ancrage — le fil vide doit se remplir sans écrire. */
const SUGGESTIONS: Record<ConversationKind, string[]> = {
  plant: [
    'Comment l’arroser en ce moment ?',
    'Est-ce le bon moment pour la tailler ?',
    'Quels sont ses besoins en hiver ?',
  ],
  diagnosis: [
    'Explique-moi les causes',
    'Par quoi je commence ?',
    'Comment éviter que ça revienne ?',
  ],
  action: [
    'Comment faire, étape par étape ?',
    'Quel matériel me faut-il ?',
    'Que se passe-t-il si je ne le fais pas ?',
  ],
}

/** « Growi réfléchit… » — trois points, ou rien du tout si l'animation gêne. */
function TypingDots() {
  const opacity = useRef(new Animated.Value(0.35)).current
  const [animate, setAnimate] = useState(true)

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((reduced) => setAnimate(!reduced))
  }, [])

  useEffect(() => {
    if (!animate) return

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 450, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.35, duration: 450, useNativeDriver: true }),
      ]),
    )
    loop.start()
    return () => loop.stop()
  }, [animate, opacity])

  return (
    <View className="self-start rounded-2xl rounded-bl-md bg-card px-4 py-3">
      <Animated.Text
        style={animate ? { opacity } : undefined}
        className="font-raleway text-body text-muted-foreground"
        accessibilityLabel="Growi rédige sa réponse"
      >
        Growi réfléchit…
      </Animated.Text>
    </View>
  )
}

function Bubble({
  role,
  content,
  photoUri,
  children,
}: {
  role: 'user' | 'assistant'
  content: string
  photoUri?: string | null
  children?: React.ReactNode
}) {
  const mine = role === 'user'
  const { width } = useWindowDimensions()

  /**
   * La photo est dimensionnée en points, pas en pourcentage.
   *
   * La bulle n'a pas de largeur définie — seulement un maximum — et Yoga n'a
   * donc rien contre quoi résoudre un `width: '100%'` : l'image se retrouvait
   * calculée à zéro, ne laissant qu'un vide à sa hauteur. On part donc d'une
   * largeur connue, et `aspectRatio` en déduit la hauteur.
   */
  const mediaWidth = Math.min(260, Math.round(width * 0.6))

  return (
    <View className={mine ? 'items-end' : 'items-stretch'}>
      <View
        className={[
          'max-w-[88%] gap-2 rounded-2xl px-4 py-3',
          mine ? 'rounded-br-md bg-lime' : 'self-start rounded-bl-md bg-card',
        ].join(' ')}
      >
        {photoUri ? (
          <View
            className="overflow-hidden rounded-xl bg-sand-dark"
            style={{ width: mediaWidth, aspectRatio: 4 / 3 }}
          >
            <Image
              source={photoUri}
              contentFit="cover"
              transition={150}
              style={StyleSheet.absoluteFill}
              accessibilityIgnoresInvertColors
            />
          </View>
        ) : null}
        {content ? <MessageText content={content} /> : null}
      </View>
      {children}
    </View>
  )
}

export interface ChatScreenProps {
  anchor: OpenConversationInput
  /** Question pré-écrite dans le champ, jamais envoyée d'office. */
  draft?: string
}

export function ChatScreen({ anchor, draft }: ChatScreenProps) {
  const router = useRouter()
  const thread = useChatThread(anchor)

  const [input, setInput] = useState(draft ?? '')
  const [photo, setPhoto] = useState<Photo | null>(null)

  const attachPhoto = useCallback(async (source: 'camera' | 'library') => {
    try {
      const picked = source === 'camera' ? await takePhoto() : await pickPhoto()
      if (picked) setPhoto(picked)
    } catch (error) {
      // Une permission refusée est un choix, pas une panne.
      if (error instanceof PermissionDeniedError) {
        Alert.alert('Autorisation nécessaire', error.message, [
          { text: 'Plus tard', style: 'cancel' },
          { text: 'Ouvrir les réglages', onPress: () => void Linking.openSettings() },
        ])
        return
      }
      Alert.alert('Photo indisponible', errorMessage(error))
    }
  }, [])

  const openPhotoMenu = () => {
    Alert.alert('Joindre une photo', 'Comment veux-tu procéder ?', [
      { text: 'Prendre une photo', onPress: () => void attachPhoto('camera') },
      { text: 'Choisir dans la galerie', onPress: () => void attachPhoto('library') },
      { text: 'Annuler', style: 'cancel' },
    ])
  }

  const submit = () => {
    thread.send(input, photo)
    setInput('')
    setPhoto(null)
  }

  if (thread.isPending) {
    return (
      <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
        <View className="px-4 pt-4">
          <ListSkeleton count={3} />
        </View>
      </SafeAreaView>
    )
  }

  if (thread.isError) {
    return (
      <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
        <ErrorState message={errorMessage(thread.error)} onRetry={thread.refetch} />
      </SafeAreaView>
    )
  }

  const conversation = thread.conversation
  const kind = (conversation?.kind ?? anchor.kind) as ConversationKind
  const empty = thread.messages.length === 0 && !thread.pendingUserMessage
  const canSend = input.trim().length > 0 && !thread.isStreaming && !thread.quotaExceeded
  const remaining = thread.quota?.remaining ?? null

  /**
   * La liste est inversée : c'est ainsi qu'elle s'ouvre sur le dernier message
   * et que le clavier la pousse dans le bon sens, sans calcul de défilement.
   */
  const rows: Array<{ key: string; render: () => React.ReactNode }> = []

  // Le quota épuisé a sa propre carte, en bas : le répéter en bulle ferait
  // lire deux fois la même chose.
  if (thread.streamError && !thread.quotaExceeded) {
    rows.push({
      key: 'erreur',
      render: () => (
        <View className="gap-2 self-start rounded-2xl bg-sand-dark px-4 py-3">
          <Text className="font-raleway text-secondary text-forest">{thread.streamError}</Text>
          <Pressable
            onPress={thread.retry}
            accessibilityRole="button"
            accessibilityLabel="Réessayer"
            className="min-h-11 flex-row items-center gap-2"
            hitSlop={8}
          >
            <RefreshCw size={15} color="#1E5631" />
            <Text className="font-raleway-semibold text-secondary text-forest">Réessayer</Text>
          </Pressable>
        </View>
      ),
    })
  }

  if (thread.isStreaming) {
    rows.push({
      key: 'en-cours',
      render: () =>
        thread.streamedText ? (
          <Bubble role="assistant" content={thread.streamedText} />
        ) : (
          <TypingDots />
        ),
    })
  }

  if (thread.pendingUserMessage) {
    const pending = thread.pendingUserMessage
    rows.push({
      key: 'envoi',
      render: () => (
        <View className="opacity-60">
          <Bubble role="user" content={pending.content} photoUri={pending.photoUri} />
        </View>
      ),
    })
  }

  for (const message of [...thread.messages].reverse()) {
    rows.push({ key: message.id, render: () => renderMessage(message) })
  }

  function renderMessage(message: ChatMessage) {
    return (
      <Bubble role={message.role} content={message.content} photoUri={message.photoUrl}>
        {message.proposals && message.proposals.length > 0 ? (
          <View className="mt-2 gap-2 self-stretch">
            {message.proposals.map((proposal) => (
              <ProposalCard
                key={proposal.id}
                proposal={proposal}
                submitting={thread.acceptingId === proposal.id}
                disabled={thread.acceptingId !== null}
                onConfirm={() => thread.accept(message.id, proposal)}
              />
            ))}
          </View>
        ) : null}
      </Bubble>
    )
  }

  return (
    <SafeAreaView className="flex-1 bg-sand" edges={['top', 'left', 'right']}>
      <View className="flex-row items-center gap-2 border-b border-border/60 px-4 py-2">
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Retour"
        >
          <ChevronLeft size={28} color="#1E5631" />
        </Pressable>
        <View className="flex-1">
          <Text className="font-poppins-bold text-section text-forest" numberOfLines={1}>
            {conversation?.title ?? 'Discussion'}
          </Text>
          <Text className="font-raleway text-caption text-muted-foreground" numberOfLines={1}>
            {subtitle(kind, conversation?.actionSnapshot?.dueDate)}
          </Text>
        </View>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        {empty ? (
          <View className="flex-1 justify-end gap-3 px-4 pb-4">
            <Text className="font-raleway text-body text-muted-foreground">
              Pose ta question à Growi, ou choisis une amorce :
            </Text>
            {SUGGESTIONS[kind].map((suggestion) => (
              <Pressable
                key={suggestion}
                onPress={() => setInput(suggestion)}
                accessibilityRole="button"
                accessibilityLabel={suggestion}
                className="min-h-11 justify-center rounded-xl bg-card px-4 py-3"
                style={({ pressed }) => (pressed ? { transform: [{ scale: 0.99 }] } : null)}
              >
                <Text className="font-raleway text-body text-forest">{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        ) : (
          <FlatList
            inverted
            data={rows}
            keyExtractor={(row) => row.key}
            renderItem={({ item }) => <View className="mb-3">{item.render()}</View>}
            contentContainerClassName="px-4 pt-3 pb-1"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          />
        )}

        {remaining !== null && remaining <= 3 && !thread.quotaExceeded ? (
          <Text className="px-4 pb-1 font-raleway text-caption text-muted-foreground">
            Il te reste {remaining} message{remaining > 1 ? 's' : ''} aujourd’hui.
          </Text>
        ) : null}

        {thread.acceptError ? (
          <Text className="px-4 pb-1 font-raleway text-caption text-destructive">
            {thread.acceptError}
          </Text>
        ) : null}

        {thread.quotaExceeded ? (
          <View className="mx-4 mb-3 gap-1 rounded-2xl bg-card p-4">
            <Text className="font-raleway-semibold text-body text-forest">
              Tu as utilisé tes messages du jour
            </Text>
            <Text className="font-raleway text-secondary text-muted-foreground">
              Ça repart demain. En attendant, tes plantes n’attendent que toi 🌿
            </Text>
          </View>
        ) : (
          <View className="gap-2 border-t border-border/60 px-4 pb-2 pt-2">
            {photo ? (
              <View className="h-20 w-20 overflow-hidden rounded-xl bg-sand-dark">
                <Image
                  source={photo.uri}
                  contentFit="cover"
                  style={{ width: '100%', height: '100%' }}
                  accessibilityIgnoresInvertColors
                />
                <Pressable
                  onPress={() => setPhoto(null)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Retirer la photo"
                  className="absolute right-1 top-1 h-6 w-6 items-center justify-center rounded-full bg-forest/80"
                >
                  <X size={14} color="#F9F7E8" />
                </Pressable>
              </View>
            ) : null}

            <View className="flex-row items-end gap-2">
              <Pressable
                onPress={openPhotoMenu}
                disabled={thread.isStreaming}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Joindre une photo"
                className="h-11 w-11 items-center justify-center rounded-lg bg-card"
              >
                <ImagePlus size={20} color="#1E5631" />
              </Pressable>

              <TextInput
                value={input}
                onChangeText={setInput}
                multiline
                maxLength={CHAT_MESSAGE_MAX_LENGTH}
                placeholder="Écris ta question…"
                placeholderTextColor="hsl(139 20% 40%)"
                className="max-h-28 min-h-11 flex-1 rounded-lg border border-input bg-card px-3 py-2.5 font-raleway text-body text-forest"
                accessibilityLabel="Ta question"
              />

              <Pressable
                onPress={submit}
                disabled={!canSend}
                accessibilityRole="button"
                accessibilityLabel="Envoyer"
                className={[
                  'h-11 w-11 items-center justify-center rounded-lg bg-lime',
                  canSend ? '' : 'opacity-40',
                ].join(' ')}
                style={({ pressed }) => (pressed && canSend ? { backgroundColor: '#a2cf6b' } : null)}
              >
                {thread.isStreaming ? (
                  <ActivityIndicator color="#1E5631" />
                ) : (
                  <SendHorizontal size={20} color="#1E5631" />
                )}
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

function subtitle(kind: ConversationKind, dueDate?: string | null): string {
  if (kind === 'diagnosis') return 'À propos de ce diagnostic'
  if (kind === 'action') {
    return dueDate ? `À faire ${formatDueDate(dueDate).label}` : 'Action du calendrier'
  }
  return 'Ton assistant jardin'
}
