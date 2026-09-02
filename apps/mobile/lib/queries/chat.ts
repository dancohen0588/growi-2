import { useCallback, useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { isApiError } from '@growi/api-client'
import {
  conversationAnchorKey,
  type ChatMessage,
  type ChatProposal,
  type ChatQuota,
  type Conversation,
  type OpenConversationInput,
} from '@growi/shared'

import { chatApi } from '@/lib/api'
import {
  chatKeys,
  diagnosisKeys,
  gardenKeys,
  planningKeys,
  plantKeys,
  summaryKeys,
} from '@/lib/queries/keys'
import { errorMessage } from '@/lib/errors'
import type { Photo } from '@/lib/photo'

export { chatKeys }

/**
 * Le fil de discussion, d'un bout à l'autre.
 *
 * Un seul hook plutôt que trois : le chargement, le flux en cours et
 * l'acceptation d'une proposition écrivent tous dans la même liste de
 * messages, et se la partager par le cache aurait demandé de recopier à chaque
 * `delta` reçu — plusieurs dizaines de fois par réponse.
 *
 * La liste vit donc en état local, amorcée par la requête d'ouverture. Le
 * cache react-query, lui, garde le fil ouvert pour qu'y revenir soit immédiat.
 */

export type ChatThread = {
  conversation: Conversation | null
  messages: ChatMessage[]
  quota: ChatQuota | null
  isPending: boolean
  isError: boolean
  error: unknown
  refetch: () => void
  /** Message que l'utilisateur vient d'envoyer, pas encore confirmé par le serveur. */
  pendingUserMessage: { content: string; photoUri: string | null } | null
  /** Réponse en cours d'écriture. */
  streamedText: string
  isStreaming: boolean
  /** Message d'échec de la dernière réponse, avec « Réessayer ». */
  streamError: string | null
  /** Le compte a épuisé ses messages du jour : la saisie se ferme. */
  quotaExceeded: boolean
  send: (content: string, photo?: Photo | null) => void
  retry: () => void
  /** Identifiant de la proposition en cours de confirmation. */
  acceptingId: string | null
  accept: (messageId: string, proposal: ChatProposal) => void
  acceptError: string | null
}

export function useChatThread(anchor: OpenConversationInput): ChatThread {
  const queryClient = useQueryClient()
  const anchorKey = conversationAnchorKey(anchor)

  // L'ouverture est un POST, mais elle *lit* autant qu'elle crée : rouvrir le
  // même point d'entrée rend le fil existant. Une requête, donc, pour profiter
  // du cache et du rechargement.
  const thread = useQuery({
    queryKey: chatKeys.thread(anchorKey),
    queryFn: () => chatApi.chat.open(anchor),
    // Le fil ne bouge que par nos propres envois : rien à revalider au retour
    // sur l'écran, et le recharger effacerait la conversation à l'écran.
    staleTime: Infinity,
    refetchOnMount: false,
    refetchOnWindowFocus: false,
  })

  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [quota, setQuota] = useState<ChatQuota | null>(null)
  const [pendingUserMessage, setPendingUserMessage] = useState<ChatThread['pendingUserMessage']>(null)
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [acceptError, setAcceptError] = useState<string | null>(null)
  const [quotaExceeded, setQuotaExceeded] = useState(false)

  const lastSent = useRef<{ content: string; photo: Photo | null } | null>(null)
  const conversationId = thread.data?.id ?? null

  // Le fil chargé amorce la liste. La dépendance porte sur l'identifiant et non
  // sur l'objet : une réponse identique ne doit pas effacer ce qui a été écrit
  // depuis.
  useEffect(() => {
    if (!thread.data) return
    setMessages(thread.data.messages)
    setQuota(thread.data.quota)
  }, [thread.data?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const runStream = useCallback(
    async (content: string, photo: Photo | null) => {
      if (!conversationId) return

      lastSent.current = { content, photo }
      setStreamError(null)
      setPendingUserMessage({ content, photoUri: photo?.uri ?? null })
      setStreamedText('')
      setIsStreaming(true)

      let text = ''
      let proposals: ChatProposal[] | null = null

      try {
        const stream = chatApi.chat.send(conversationId, {
          content,
          ...(photo ? { imageBase64: photo.dataUrl } : {}),
        })

        for await (const event of stream) {
          switch (event.event) {
            case 'meta':
              // Le serveur a écrit le message : la bulle provisoire cède la
              // place à la vraie, avec son identifiant et sa photo stockée.
              setPendingUserMessage(null)
              setMessages((current) => [...current, event.data.userMessage])
              break
            case 'text':
              text += event.data.delta
              setStreamedText(text)
              break
            case 'proposals':
              proposals = event.data.proposals
              break
            case 'done':
              setMessages((current) => [...current, event.data.assistantMessage])
              setQuota(event.data.quota)
              break
            case 'error':
              // Du texte a pu arriver avant la panne : il est conservé côté
              // serveur, on le montre donc plutôt que de le faire disparaître.
              if (text) {
                setMessages((current) => [
                  ...current,
                  interruptedMessage(conversationId, text, proposals),
                ])
              }
              setStreamError(event.data.message)
              break
          }
        }
      } catch (error) {
        // Un refus arrive avant le premier événement : rien n'a été écrit, la
        // bulle provisoire s'efface.
        setPendingUserMessage(null)
        if (isApiError(error) && error.code === 'QUOTA_EXCEEDED') setQuotaExceeded(true)
        setStreamError(errorMessage(error))
      } finally {
        setStreamedText('')
        setIsStreaming(false)
      }
    },
    [conversationId],
  )

  const send = useCallback(
    (content: string, photo?: Photo | null) => {
      const trimmed = content.trim()
      if (!trimmed || isStreaming) return
      void runStream(trimmed, photo ?? null)
    },
    [isStreaming, runStream],
  )

  /**
   * Repose la même question.
   *
   * La précédente reste dans le fil : elle a bien été envoyée, et elle a
   * compté pour le quota. La faire disparaître laisserait croire le contraire.
   */
  const retry = useCallback(() => {
    const previous = lastSent.current
    if (!previous || isStreaming) return
    void runStream(previous.content, previous.photo)
  }, [isStreaming, runStream])

  const accept = useCallback(
    (messageId: string, proposal: ChatProposal) => {
      if (!conversationId || acceptingId) return

      setAcceptingId(proposal.id)
      setAcceptError(null)

      chatApi.chat
        .acceptProposal(conversationId, { messageId, proposalId: proposal.id })
        .then(({ message }) => {
          setMessages((current) => current.map((m) => (m.id === message.id ? message : m)))

          // La tâche ou le geste vient d'apparaître ailleurs : le planning, la
          // fiche et son journal doivent être relus.
          void queryClient.invalidateQueries({ queryKey: planningKeys.all })
          void queryClient.invalidateQueries({ queryKey: plantKeys.all })
          void queryClient.invalidateQueries({ queryKey: gardenKeys.all })
          void queryClient.invalidateQueries({ queryKey: diagnosisKeys.all })
          void queryClient.invalidateQueries({ queryKey: summaryKeys.all })
        })
        .catch((error: unknown) => setAcceptError(errorMessage(error)))
        .finally(() => setAcceptingId(null))
    },
    [acceptingId, conversationId, queryClient],
  )

  return {
    conversation: thread.data ?? null,
    messages,
    quota,
    isPending: thread.isPending,
    isError: thread.isError,
    error: thread.error,
    refetch: () => void thread.refetch(),
    pendingUserMessage,
    streamedText,
    isStreaming,
    streamError,
    quotaExceeded: quotaExceeded || quota?.remaining === 0,
    send,
    retry,
    acceptingId,
    accept,
    acceptError,
  }
}

/**
 * La réponse interrompue, telle qu'on l'affiche.
 *
 * Le serveur l'a persistée sous un identifiant qu'on ne connaît pas — le flux
 * s'est arrêté avant de le dire. Rouvrir le fil rendra la vraie.
 */
function interruptedMessage(
  conversationId: string,
  content: string,
  proposals: ChatProposal[] | null,
): ChatMessage {
  return {
    id: `interrompu-${Date.now()}`,
    conversationId,
    role: 'assistant',
    content,
    photoUrl: null,
    proposals,
    createdAt: new Date().toISOString(),
  }
}

/** Les fils déjà ouverts pour une plante — « Tes conversations » sur la fiche. */
export function useConversationsForPlant(plantInstanceId: string) {
  return useQuery({
    queryKey: chatKeys.forPlant(plantInstanceId),
    queryFn: () => chatApi.chat.listForPlant(plantInstanceId),
    enabled: Boolean(plantInstanceId),
  })
}
