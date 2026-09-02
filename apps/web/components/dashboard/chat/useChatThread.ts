'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { isApiError } from '@growi/api-client'
import type {
  ChatMessage,
  ChatProposal,
  ChatQuota,
  Conversation,
  OpenConversationInput,
} from '@growi/shared'

import { api } from '@/lib/api-client'

/**
 * Le fil de discussion, côté web.
 *
 * Même déroulé que le mobile — ouverture, flux, confirmation — mais en état
 * React nu : le dashboard n'a pas de couche de cache, et un fil ne se relit
 * pas d'un écran à l'autre. Ce qui compte est ailleurs, dans le contrat SSE
 * que les deux partagent.
 */

export type WebChatThread = {
  conversation: Conversation | null
  messages: ChatMessage[]
  quota: ChatQuota | null
  loading: boolean
  loadError: string | null
  reload: () => void
  pendingUserMessage: { content: string; photoUrl: string | null } | null
  streamedText: string
  isStreaming: boolean
  streamError: string | null
  quotaExceeded: boolean
  send: (content: string, imageDataUrl?: string | null) => void
  retry: () => void
  acceptingId: string | null
  accept: (messageId: string, proposal: ChatProposal) => void
  acceptError: string | null
}

/** Message affichable d'une erreur d'API — la règle est la même qu'en mobile. */
function readableError(error: unknown): string {
  if (!isApiError(error)) return "Une erreur inattendue s'est produite. Réessaie."
  if (error.isNetworkError) return 'Impossible de joindre Growi. Vérifie ta connexion.'
  if (error.isUnauthorized) return 'Ta session a expiré. Reconnecte-toi.'
  if (error.status === 429 || error.isValidationError) return error.message
  if (error.isServerError) return 'Growi est momentanément indisponible. Réessaie dans un instant.'
  return "Une erreur inattendue s'est produite. Réessaie."
}

export function useChatThread(anchor: OpenConversationInput | null): WebChatThread {
  const [conversation, setConversation] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [quota, setQuota] = useState<ChatQuota | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  const [pendingUserMessage, setPendingUserMessage] = useState<
    WebChatThread['pendingUserMessage']
  >(null)
  const [streamedText, setStreamedText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [streamError, setStreamError] = useState<string | null>(null)
  const [quotaExceeded, setQuotaExceeded] = useState(false)
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [acceptError, setAcceptError] = useState<string | null>(null)

  const lastSent = useRef<{ content: string; imageDataUrl: string | null } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // L'ancrage est sérialisé pour la dépendance : l'objet est recréé à chaque
  // rendu du panneau, et le comparer par référence rouvrirait le fil en boucle.
  const anchorKey = anchor ? JSON.stringify(anchor) : null

  useEffect(() => {
    if (!anchor) return

    let cancelled = false
    setLoading(true)
    setLoadError(null)

    api.chat
      .open(anchor)
      .then((detail) => {
        if (cancelled) return
        setConversation(detail)
        setMessages(detail.messages)
        setQuota(detail.quota)
      })
      .catch((error: unknown) => {
        if (!cancelled) setLoadError(readableError(error))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [anchorKey, reloadToken]) // eslint-disable-line react-hooks/exhaustive-deps

  const runStream = useCallback(
    async (conversationId: string, content: string, imageDataUrl: string | null) => {
      lastSent.current = { content, imageDataUrl }
      setStreamError(null)
      setPendingUserMessage({ content, photoUrl: imageDataUrl })
      setStreamedText('')
      setIsStreaming(true)

      let text = ''
      let proposals: ChatProposal[] | null = null

      try {
        const stream = api.chat.send(conversationId, {
          content,
          ...(imageDataUrl ? { imageBase64: imageDataUrl } : {}),
        })

        for await (const event of stream) {
          switch (event.event) {
            case 'meta':
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
              // Le texte déjà reçu est conservé côté serveur : le faire
              // disparaître de l'écran serait mentir sur ce qui existe.
              if (text) {
                setMessages((current) => [
                  ...current,
                  {
                    id: `interrompu-${Date.now()}`,
                    conversationId,
                    role: 'assistant',
                    content: text,
                    photoUrl: null,
                    proposals,
                    createdAt: new Date().toISOString(),
                  },
                ])
              }
              setStreamError(event.data.message)
              break
          }
        }
      } catch (error) {
        setPendingUserMessage(null)
        if (isApiError(error) && error.code === 'QUOTA_EXCEEDED') setQuotaExceeded(true)
        setStreamError(readableError(error))
      } finally {
        setStreamedText('')
        setIsStreaming(false)
      }
    },
    [],
  )

  const send = useCallback(
    (content: string, imageDataUrl?: string | null) => {
      const trimmed = content.trim()
      if (!trimmed || !conversation || isStreaming) return
      void runStream(conversation.id, trimmed, imageDataUrl ?? null)
    },
    [conversation, isStreaming, runStream],
  )

  /**
   * Repose la même question. La précédente reste affichée : elle a bien été
   * envoyée, et elle a compté pour le quota.
   */
  const retry = useCallback(() => {
    const previous = lastSent.current
    if (!previous || !conversation || isStreaming) return
    void runStream(conversation.id, previous.content, previous.imageDataUrl)
  }, [conversation, isStreaming, runStream])

  const accept = useCallback(
    (messageId: string, proposal: ChatProposal) => {
      if (!conversation || acceptingId) return

      setAcceptingId(proposal.id)
      setAcceptError(null)

      api.chat
        .acceptProposal(conversation.id, { messageId, proposalId: proposal.id })
        .then(({ message }) => {
          setMessages((current) => current.map((m) => (m.id === message.id ? message : m)))
        })
        .catch((error: unknown) => setAcceptError(readableError(error)))
        .finally(() => setAcceptingId(null))
    },
    [acceptingId, conversation],
  )

  return {
    conversation,
    messages,
    quota,
    loading,
    loadError,
    reload: () => setReloadToken((token) => token + 1),
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
