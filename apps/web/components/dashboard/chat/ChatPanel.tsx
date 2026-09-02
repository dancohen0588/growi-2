'use client'

import { useEffect, useRef, useState } from 'react'
import {
  CalendarPlus,
  Check,
  ImagePlus,
  Loader2,
  NotebookPen,
  RefreshCw,
  SendHorizontal,
  X,
} from 'lucide-react'
import {
  CHAT_MESSAGE_MAX_LENGTH,
  type ChatMessage,
  type ChatProposal,
  type ConversationKind,
  type OpenConversationInput,
} from '@growi/shared'

import { MessageText } from '@/components/dashboard/chat/MessageText'
import { useChatThread } from '@/components/dashboard/chat/useChatThread'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { prepareImageFile } from '@/lib/image-compression'

/**
 * Le fil de discussion, en panneau latéral.
 *
 * Panneau et non page : on discute *de* ce qu'on a sous les yeux — un
 * diagnostic, une tâche du calendrier — et quitter l'écran pour poser une
 * question ferait perdre le contexte qui a motivé la question.
 */

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

const PROPOSAL_ICON: Record<ChatProposal['kind'], typeof CalendarPlus> = {
  plan_task: CalendarPlus,
  care_log: NotebookPen,
  mark_done: Check,
}

const PROPOSAL_DONE: Record<ChatProposal['kind'], string> = {
  plan_task: 'Planifié',
  care_log: 'Noté',
  mark_done: 'Fait',
}

function ProposalCard({
  proposal,
  submitting,
  disabled,
  onConfirm,
}: {
  proposal: ChatProposal
  submitting: boolean
  disabled: boolean
  onConfirm: () => void
}) {
  // « Ignorer » ne fait que masquer : rien n'est écrit, et rouvrir le fil
  // retrouve la proposition.
  const [hidden, setHidden] = useState(false)
  const Icon = PROPOSAL_ICON[proposal.kind]

  if (proposal.acceptedAt) {
    return (
      <p
        className="inline-flex items-center gap-2 rounded-xl bg-lime/25 px-3 py-2 font-raleway text-sm text-forest"
        data-testid="chat-proposal-accepted"
      >
        <Check size={15} aria-hidden />
        {PROPOSAL_DONE[proposal.kind]} · {proposal.title}
      </p>
    )
  }

  if (hidden) return null

  return (
    <div
      className="flex flex-col gap-2 rounded-xl border border-forest/15 bg-white p-3"
      data-testid="chat-proposal"
    >
      <p className="flex items-start gap-2 font-raleway text-sm text-forest">
        <Icon size={16} className="mt-0.5 shrink-0 text-forest/70" aria-hidden />
        {proposal.title}
      </p>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onConfirm}
          disabled={disabled || submitting}
          className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-lime px-4 py-2 font-poppins text-sm font-semibold text-forest transition-colors hover:bg-lime/80 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 size={15} className="animate-spin" aria-hidden />
          ) : (
            <Check size={15} aria-hidden />
          )}
          Confirmer
        </button>
        <button
          type="button"
          onClick={() => setHidden(true)}
          disabled={submitting}
          className="font-raleway text-xs text-forest/60 underline underline-offset-2 transition-colors hover:text-forest"
        >
          Ignorer
        </button>
      </div>
    </div>
  )
}

function Bubble({
  role,
  content,
  photoUrl,
  children,
}: {
  role: 'user' | 'assistant'
  content: string
  photoUrl?: string | null
  children?: React.ReactNode
}) {
  const mine = role === 'user'

  return (
    <div className={`flex flex-col gap-2 ${mine ? 'items-end' : 'items-start'}`}>
      <div
        className={`max-w-[88%] rounded-2xl px-4 py-3 ${
          mine ? 'rounded-br-md bg-lime text-forest' : 'rounded-bl-md bg-white text-forest'
        }`}
      >
        {photoUrl ? (
          <span className="mb-2 block overflow-hidden rounded-xl">
            {/* Une data URL ou une URL Supabase : `next/image` ne sait pas
                optimiser la première, on reste donc sur une balise simple. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoUrl} alt="Photo jointe" className="h-40 w-full object-cover" />
          </span>
        ) : null}
        {content ? <MessageText content={content} /> : null}
      </div>
      {children ? <div className="flex w-full flex-col gap-2">{children}</div> : null}
    </div>
  )
}

export interface ChatPanelProps {
  anchor: OpenConversationInput | null
  draft?: string
  open: boolean
  onClose: () => void
}

export function ChatPanel({ anchor, draft, open, onClose }: ChatPanelProps) {
  const thread = useChatThread(open ? anchor : null)

  const [input, setInput] = useState('')
  const [image, setImage] = useState<{ dataUrl: string } | null>(null)
  const [imageError, setImageError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const bottom = useRef<HTMLDivElement>(null)

  // Le brouillon est pré-écrit à l'ouverture, jamais envoyé.
  useEffect(() => {
    if (open) setInput(draft ?? '')
  }, [open, draft])

  // Le fil suit la réponse pendant qu'elle s'écrit.
  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [thread.messages.length, thread.streamedText, thread.pendingUserMessage])

  const pickImage = async (file: File | undefined) => {
    if (!file) return
    setImageError(null)

    const prepared = await prepareImageFile(file)
    if ('error' in prepared) {
      setImageError(prepared.error)
      return
    }
    setImage({ dataUrl: prepared.dataUrl })
  }

  const submit = () => {
    thread.send(input, image?.dataUrl)
    setInput('')
    setImage(null)
  }

  const kind = (thread.conversation?.kind ?? anchor?.kind ?? 'plant') as ConversationKind
  const empty = thread.messages.length === 0 && !thread.pendingUserMessage && !thread.isStreaming
  const canSend = input.trim().length > 0 && !thread.isStreaming && !thread.quotaExceeded
  const remaining = thread.quota?.remaining ?? null

  const renderMessage = (message: ChatMessage) => (
    <Bubble
      key={message.id}
      role={message.role}
      content={message.content}
      photoUrl={message.photoUrl}
    >
      {message.proposals?.map((proposal) => (
        <ProposalCard
          key={proposal.id}
          proposal={proposal}
          submitting={thread.acceptingId === proposal.id}
          disabled={thread.acceptingId !== null}
          onConfirm={() => thread.accept(message.id, proposal)}
        />
      ))}
    </Bubble>
  )

  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent
        side="right"
        className="flex w-full flex-col gap-0 bg-sand p-0 sm:max-w-[440px]"
        data-testid="chat-panel"
      >
        <SheetHeader className="border-b border-forest/10 px-5 py-4 text-left">
          <SheetTitle className="font-poppins text-base text-forest">
            {thread.conversation?.title ?? 'Discussion'}
          </SheetTitle>
          <p className="font-raleway text-xs text-forest/60">
            {kind === 'diagnosis'
              ? 'À propos de ce diagnostic'
              : kind === 'action'
                ? 'Action du calendrier'
                : 'Ton assistant jardin'}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {thread.loading ? (
            <p className="font-raleway text-sm text-forest/60">Ouverture de la discussion…</p>
          ) : thread.loadError ? (
            <div className="flex flex-col items-start gap-2">
              <p className="font-raleway text-sm text-forest/80">{thread.loadError}</p>
              <button
                type="button"
                onClick={thread.reload}
                className="inline-flex items-center gap-1.5 font-raleway text-sm font-semibold text-forest underline underline-offset-2"
              >
                <RefreshCw size={14} aria-hidden />
                Réessayer
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {empty ? (
                <div className="flex flex-col gap-2">
                  <p className="font-raleway text-sm text-forest/60">
                    Pose ta question à Growi, ou choisis une amorce :
                  </p>
                  {SUGGESTIONS[kind].map((suggestion) => (
                    <button
                      key={suggestion}
                      type="button"
                      onClick={() => setInput(suggestion)}
                      className="rounded-xl bg-white px-4 py-3 text-left font-raleway text-sm text-forest transition-colors hover:bg-white/70"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              ) : null}

              {thread.messages.map(renderMessage)}

              {thread.pendingUserMessage ? (
                <div className="opacity-60">
                  <Bubble
                    role="user"
                    content={thread.pendingUserMessage.content}
                    photoUrl={thread.pendingUserMessage.photoUrl}
                  />
                </div>
              ) : null}

              {thread.isStreaming ? (
                thread.streamedText ? (
                  <Bubble role="assistant" content={thread.streamedText} />
                ) : (
                  <p
                    className="w-fit animate-pulse rounded-2xl rounded-bl-md bg-white px-4 py-3 font-raleway text-sm text-forest/60"
                    data-testid="chat-thinking"
                  >
                    Growi réfléchit…
                  </p>
                )
              ) : null}

              {thread.streamError && !thread.quotaExceeded ? (
                <div className="flex w-fit flex-col items-start gap-1 rounded-2xl bg-sand-dark/60 px-4 py-3">
                  <p className="font-raleway text-sm text-forest/80">{thread.streamError}</p>
                  <button
                    type="button"
                    onClick={thread.retry}
                    className="inline-flex items-center gap-1.5 font-raleway text-sm font-semibold text-forest underline underline-offset-2"
                  >
                    <RefreshCw size={14} aria-hidden />
                    Réessayer
                  </button>
                </div>
              ) : null}

              <div ref={bottom} />
            </div>
          )}
        </div>

        {thread.acceptError ? (
          <p className="px-5 pb-1 font-raleway text-xs text-red-600">{thread.acceptError}</p>
        ) : null}

        {thread.quotaExceeded ? (
          <div className="m-5 rounded-2xl border border-forest/15 bg-white p-4" data-testid="chat-quota">
            <p className="font-poppins text-sm font-semibold text-forest">
              Tu as utilisé tes messages du jour
            </p>
            <p className="mt-1 font-raleway text-sm text-forest/70">
              Ça repart demain. En attendant, tes plantes n’attendent que toi 🌿
            </p>
          </div>
        ) : (
          <div className="border-t border-forest/10 px-5 py-3">
            {remaining !== null && remaining <= 3 ? (
              <p className="mb-2 font-raleway text-xs text-forest/60">
                Il te reste {remaining} message{remaining > 1 ? 's' : ''} aujourd’hui.
              </p>
            ) : null}

            {image ? (
              <div className="mb-2 flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.dataUrl}
                  alt="Photo à envoyer"
                  className="h-16 w-16 rounded-lg object-cover"
                />
                <button
                  type="button"
                  onClick={() => setImage(null)}
                  className="rounded-full bg-forest/10 p-1 text-forest transition-colors hover:bg-forest/20"
                  aria-label="Retirer la photo"
                >
                  <X size={14} aria-hidden />
                </button>
              </div>
            ) : null}

            {imageError ? (
              <p className="mb-2 font-raleway text-xs text-red-600">{imageError}</p>
            ) : null}

            <div className="flex items-end gap-2">
              <input
                ref={fileInput}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) => void pickImage(event.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                disabled={thread.isStreaming}
                className="rounded-lg border border-forest/20 bg-white p-2.5 text-forest transition-colors hover:bg-white/70 disabled:opacity-50"
                aria-label="Joindre une photo"
              >
                <ImagePlus size={18} aria-hidden />
              </button>

              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  // Entrée envoie, Maj+Entrée passe à la ligne : c'est ce
                  // qu'on attend d'un fil de discussion au clavier.
                  if (event.key === 'Enter' && !event.shiftKey && canSend) {
                    event.preventDefault()
                    submit()
                  }
                }}
                rows={1}
                maxLength={CHAT_MESSAGE_MAX_LENGTH}
                placeholder="Écris ta question…"
                aria-label="Ta question"
                className="max-h-28 min-h-[42px] flex-1 resize-none rounded-lg border border-forest/20 bg-white px-3 py-2.5 font-raleway text-sm text-forest outline-none focus:border-forest/40"
              />

              <button
                type="button"
                onClick={submit}
                disabled={!canSend}
                className="rounded-lg bg-lime p-2.5 text-forest transition-colors hover:bg-lime/80 disabled:opacity-40"
                aria-label="Envoyer"
              >
                {thread.isStreaming ? (
                  <Loader2 size={18} className="animate-spin" aria-hidden />
                ) : (
                  <SendHorizontal size={18} aria-hidden />
                )}
              </button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
