'use client'

import { Suspense, createContext, useCallback, useContext, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { chatActionSnapshotSchema, type GardenAction, type OpenConversationInput } from '@growi/shared'

import { ChatPanel } from '@/components/dashboard/chat/ChatPanel'

/**
 * L'ouverture du fil, portée par l'URL.
 *
 * Le panneau doit pouvoir s'ouvrir depuis n'importe quelle page du dashboard —
 * une recommandation de diagnostic, une carte du calendrier, une fiche plante —
 * sans que chacune ait à héberger le composant. L'état passe donc par la barre
 * d'adresse : le lien est partageable, le bouton « précédent » referme le
 * panneau, et un rechargement retrouve la conversation.
 */

type OpenChat = (params: Record<string, string>) => void

const ChatPanelContext = createContext<OpenChat>(() => {})

/** Ouvre le fil depuis n'importe quel composant client du dashboard. */
export function useChatPanel() {
  return useContext(ChatPanelContext)
}

// ─── Les trois ancrages, en paramètres d'URL ───────────────────────────────

export function plantChatParams(plantId: string): Record<string, string> {
  return { chat: 'plant', plantId }
}

export function diagnosisChatParams(
  plantId: string,
  diagnosisId: string,
  draft?: string,
): Record<string, string> {
  return { chat: 'diagnosis', plantId, diagnosisId, ...(draft ? { draft } : {}) }
}

/**
 * Fil d'une action du calendrier.
 *
 * Le cliché de l'action voyage avec : les actions du moteur sont recalculées à
 * chaque évaluation et ne sont persistées nulle part.
 */
export function actionChatParams(action: GardenAction): Record<string, string> | null {
  if (!action.plantId) return null

  const snapshot = {
    type: action.type,
    label: action.label,
    shortLabel: action.shortLabel,
    dueDate: action.dueDate,
    priority: action.priority,
    ...(action.source ? { source: action.source } : {}),
  }

  return {
    chat: 'action',
    plantId: action.plantId,
    action: JSON.stringify(snapshot),
    ...(action.taskId ? { taskId: action.taskId } : { actionKey: action.id }),
  }
}

const CHAT_PARAMS = ['chat', 'plantId', 'diagnosisId', 'taskId', 'actionKey', 'action', 'draft']

function anchorFrom(params: URLSearchParams): OpenConversationInput | null {
  const kind = params.get('chat')
  const plantInstanceId = params.get('plantId')
  if (!kind || !plantInstanceId) return null

  if (kind === 'diagnosis') {
    const diagnosisId = params.get('diagnosisId')
    return diagnosisId ? { kind: 'diagnosis', plantInstanceId, diagnosisId } : null
  }

  if (kind === 'action') {
    const raw = params.get('action')
    const taskId = params.get('taskId')
    const actionKey = params.get('actionKey')
    if (!raw || (!taskId && !actionKey)) return null

    let parsed
    try {
      parsed = chatActionSnapshotSchema.safeParse(JSON.parse(raw))
    } catch {
      return null
    }
    if (!parsed.success) return null

    return {
      kind: 'action',
      plantInstanceId,
      // L'un ou l'autre, jamais les deux : le contrat partagé le refuse.
      ...(taskId ? { taskId } : { actionKey: actionKey! }),
      action: parsed.data,
    }
  }

  return { kind: 'plant', plantInstanceId }
}

function ChatPanelHost({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const openChat = useCallback<OpenChat>(
    (params) => {
      const next = new URLSearchParams(searchParams.toString())
      for (const key of CHAT_PARAMS) next.delete(key)
      for (const [key, value] of Object.entries(params)) next.set(key, value)

      // `scroll: false` : la page reste où elle est, le panneau se pose
      // par-dessus. Sans cela, ouvrir depuis le bas d'un diagnostic
      // remonterait la lecture en haut de page.
      router.push(`${pathname}?${next.toString()}`, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  const close = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString())
    for (const key of CHAT_PARAMS) next.delete(key)
    const query = next.toString()
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [pathname, router, searchParams])

  const anchor = useMemo(() => anchorFrom(searchParams), [searchParams])
  const draft = searchParams.get('draft') ?? undefined

  return (
    <ChatPanelContext.Provider value={openChat}>
      {children}
      <ChatPanel anchor={anchor} draft={draft} open={anchor !== null} onClose={close} />
    </ChatPanelContext.Provider>
  )
}

/**
 * `useSearchParams` demande une frontière de suspense : sans elle, Next refuse
 * de prérendre les pages qui en descendent.
 */
export function ChatPanelProvider({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={children}>
      <ChatPanelHost>{children}</ChatPanelHost>
    </Suspense>
  )
}
