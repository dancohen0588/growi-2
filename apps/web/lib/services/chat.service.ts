/**
 * Agent conversationnel « Growi ».
 *
 * Il conseille, et il **propose** — il n'exécute rien. Une réponse peut porter
 * jusqu'à deux cartes d'action ; elles ne deviennent une tâche ou un geste
 * qu'après confirmation, et c'est alors la copie écrite en base qui est
 * exécutée, jamais ce que le client renvoie.
 *
 * Le contexte est **recalculé à chaque message** : la météo change, un geste a
 * pu être noté entre deux questions. Aucun état n'est gardé en mémoire du
 * serveur — l'historique est relu en base à chaque tour.
 *
 * Ce service produit la forme JSON du fil (`toChatMessage`, `toConversation`)
 * plutôt que de rendre des entités Prisma nues comme ses voisins : le format
 * des messages fait partie du protocole SSE qu'il implémente, et le séparer
 * reviendrait à écrire deux fois la lecture des propositions.
 */

import { randomUUID } from 'node:crypto'

import {
  CARE_LOG_TYPE_BY_ACTION,
  CARE_LOG_TYPE_LABELS,
  CHAT_DAILY_LIMIT_FREE,
  CHAT_HISTORY_WINDOW,
  CHAT_MAX_PROPOSALS,
  chatActionSnapshotSchema,
  chatProposalSchema,
  conversationAnchorKey,
  diagnosisSuccessSchema,
  type AcceptProposalInput,
  type ActionType,
  type ChatActionSnapshot,
  type ChatMessage,
  type ChatProposal,
  type ChatQuota,
  type ChatStreamEvent,
  type Conversation,
  type ConversationDetail,
  type ConversationKind,
  type OpenConversationInput,
  type SendMessageInput,
} from '@growi/shared'
import type { Conversation as PrismaConversation, Message as PrismaMessage } from '@prisma/client'

import { prisma } from '@/lib/prisma'
import { markActionDone } from '@/lib/services/advice.service'
import {
  PLANT_ANCHOR,
  actionAnchor,
  buildChatSystemInstruction,
  diagnosisAnchor,
  shortFrenchDate,
} from '@/lib/services/chat-prompt'
import { CHAT_TOOLS, parseToolCall, type ToolCallDraft } from '@/lib/services/chat-tools'
import { ServiceError } from '@/lib/services/errors'
import {
  GEMINI_FAILURE_MESSAGES,
  parseImagePayload,
  requireGeminiKey,
  streamChat,
  toArrayBuffer,
  type ChatPart,
  type ChatTurn,
  type GeminiImage,
} from '@/lib/services/gemini'
import { logCare } from '@/lib/services/log.service'
import { buildPlantContext, contextBlock } from '@/lib/services/plant-context'
import { PRIORITY_BY_DIAGNOSIS, completeTask, isoDay } from '@/lib/services/task.service'
import { uploadPhoto } from '@/lib/storage'

/** Réponse courte : l'utilisateur lit sur un téléphone, et peut relancer. */
const CHAT_MAX_OUTPUT_TOKENS = 700

const LOG = '[chat]'

// ─── Quota journalier ──────────────────────────────────────────────────────

const HOUR_MS = 3_600_000

/** Un fuseau que `Intl` refuse ne doit pas faire échouer une conversation. */
function safeTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone })
    return timeZone
  } catch {
    console.error(`${LOG} fuseau inconnu, repli sur Europe/Paris :`, timeZone)
    return 'Europe/Paris'
  }
}

/** Décalage du fuseau à cet instant, en millisecondes à l'est de UTC. */
function zoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date)

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  )
  return asUtc - (date.getTime() - date.getMilliseconds())
}

function startOfZonedDay(date: Date, timeZone: string): Date {
  const offset = zoneOffsetMs(date, timeZone)
  const local = new Date(date.getTime() + offset)
  const midnight = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())
  return new Date(midnight - offset)
}

/**
 * La journée de l'utilisateur, dans **son** fuseau.
 *
 * Compter en UTC ferait basculer le quota à 2 h du matin pour un utilisateur
 * français en été — au milieu de sa soirée, pas au bout de sa journée.
 *
 * Le prochain minuit est cherché depuis `début + 26 h` : plus qu'une journée
 * d'hiver rallongée (25 h), assez peu pour ne pas sauter par-dessus une
 * journée d'été raccourcie (23 h).
 */
export function chatDayBounds(now: Date, timeZone: string): { start: Date; resetsAt: Date } {
  const zone = safeTimeZone(timeZone)
  const start = startOfZonedDay(now, zone)
  return { start, resetsAt: startOfZonedDay(new Date(start.getTime() + 26 * HOUR_MS), zone) }
}

async function buildQuota(
  userId: string,
  user: { plan: string; timezone: string },
  now: Date,
): Promise<ChatQuota> {
  const { start, resetsAt } = chatDayBounds(now, user.timezone)

  const used = await prisma.message.count({
    where: { userId, role: 'user', createdAt: { gte: start, lt: resetsAt } },
  })

  const limit = user.plan === 'FREE' ? CHAT_DAILY_LIMIT_FREE : null

  return {
    limit,
    used,
    remaining: limit === null ? null : Math.max(0, limit - used),
    resetsAt: resetsAt.toISOString(),
  }
}

// ─── Sérialisation ─────────────────────────────────────────────────────────

/**
 * Les propositions d'un message, relues depuis le Json.
 *
 * Une proposition hors schéma — écrite par une version antérieure du code —
 * est écartée plutôt que de faire échouer la lecture du fil : mieux vaut un
 * message sans sa carte qu'une conversation illisible.
 */
function readProposals(raw: unknown): ChatProposal[] | null {
  if (!Array.isArray(raw)) return null
  const kept = raw
    .map((item) => chatProposalSchema.safeParse(item))
    .filter((r): r is { success: true; data: ChatProposal } => r.success)
    .map((r) => r.data)
  return kept.length > 0 ? kept : null
}

function toChatMessage(message: PrismaMessage): ChatMessage {
  return {
    id: message.id,
    conversationId: message.conversationId,
    role: message.role as ChatMessage['role'],
    content: message.content,
    photoUrl: message.photoUrl,
    proposals: readProposals(message.proposals),
    createdAt: message.createdAt.toISOString(),
  }
}

function readActionSnapshot(raw: unknown): ChatActionSnapshot | null {
  const parsed = chatActionSnapshotSchema.safeParse(raw)
  return parsed.success ? parsed.data : null
}

function toConversation(conversation: PrismaConversation): Conversation {
  return {
    id: conversation.id,
    kind: conversation.kind as ConversationKind,
    title: conversation.title,
    plantInstanceId: conversation.plantInstanceId,
    diagnosisId: conversation.diagnosisId,
    taskId: conversation.taskId,
    actionKey: conversation.actionKey,
    actionSnapshot: readActionSnapshot(conversation.actionSnapshot),
    lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    createdAt: conversation.createdAt.toISOString(),
  }
}

// ─── Ouverture d'un fil ────────────────────────────────────────────────────

const PLANT_NAME_SELECT = {
  id: true,
  gardenId: true,
  customName: true,
  catalogPlant: { select: { commonName: true } },
} as const

type NamedPlant = {
  id: string
  gardenId: string | null
  customName: string | null
  catalogPlant: { commonName: string } | null
}

function plantName(plant: NamedPlant): string {
  return plant.customName ?? plant.catalogPlant?.commonName ?? 'Ma plante'
}

/** @throws ServiceError('NOT_FOUND') si la plante n'est pas à l'utilisateur. */
async function requirePlant(userId: string, plantInstanceId: string): Promise<NamedPlant> {
  const plant = await prisma.plantInstance.findFirst({
    where: { id: plantInstanceId, userId },
    select: PLANT_NAME_SELECT,
  })
  if (!plant) throw new ServiceError('NOT_FOUND', 'Plante introuvable')
  return plant
}

async function requireUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true, timezone: true },
  })
  if (!user) throw new ServiceError('NOT_FOUND', 'Compte introuvable')
  return user
}

/**
 * Ouvre le fil de cet ancrage, ou retrouve le sien.
 *
 * L'appartenance de **chaque** pièce de l'ancrage est vérifiée : la plante, et
 * le diagnostic ou la tâche dont on se réclame. Sans quoi il suffirait de
 * citer l'identifiant d'un diagnostic d'autrui pour s'en faire raconter le
 * contenu par l'agent.
 *
 * @throws ServiceError('NOT_FOUND')
 */
export async function openConversation(
  userId: string,
  input: OpenConversationInput,
  now: Date = new Date(),
): Promise<ConversationDetail> {
  const plant = await requirePlant(userId, input.plantInstanceId)
  const anchorKey = conversationAnchorKey(input)

  const existing = await prisma.conversation.findUnique({
    where: { userId_anchorKey: { userId, anchorKey } },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })

  const user = await requireUser(userId)
  if (existing) {
    return {
      ...toConversation(existing),
      messages: existing.messages.map(toChatMessage),
      quota: await buildQuota(userId, user, now),
    }
  }

  const data = { userId, plantInstanceId: plant.id, kind: input.kind, anchorKey }

  let created: PrismaConversation
  if (input.kind === 'plant') {
    created = await prisma.conversation.create({ data: { ...data, title: plantName(plant) } })
  } else if (input.kind === 'diagnosis') {
    const diagnosis = await prisma.diagnosis.findFirst({
      where: { id: input.diagnosisId, plantInstanceId: plant.id, userId },
      select: { id: true, createdAt: true },
    })
    if (!diagnosis) throw new ServiceError('NOT_FOUND', 'Diagnostic introuvable')

    created = await prisma.conversation.create({
      data: {
        ...data,
        diagnosisId: diagnosis.id,
        title: `Diagnostic du ${shortFrenchDate(diagnosis.createdAt)}`,
      },
    })
  } else {
    if (input.taskId) {
      const task = await prisma.plantTask.findFirst({
        where: { id: input.taskId, userId, plantInstanceId: plant.id },
        select: { id: true },
      })
      if (!task) throw new ServiceError('NOT_FOUND', 'Tâche introuvable')
    }

    created = await prisma.conversation.create({
      data: {
        ...data,
        taskId: input.taskId ?? null,
        actionKey: input.actionKey ?? null,
        actionSnapshot: input.action,
        title: `${input.action.shortLabel} — ${plantName(plant)}`,
      },
    })
  }

  return {
    ...toConversation(created),
    messages: [],
    quota: await buildQuota(userId, user, now),
  }
}

/** @throws ServiceError('NOT_FOUND') si le fil n'est pas à l'utilisateur. */
export async function getConversation(
  userId: string,
  conversationId: string,
  now: Date = new Date(),
): Promise<ConversationDetail> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  })
  if (!conversation) throw new ServiceError('NOT_FOUND', 'Conversation introuvable')

  return {
    ...toConversation(conversation),
    messages: conversation.messages.map(toChatMessage),
    quota: await buildQuota(userId, await requireUser(userId), now),
  }
}

/** Les fils d'un compte, du plus récent au plus ancien. */
export async function listConversations(
  userId: string,
  plantInstanceId?: string,
): Promise<Conversation[]> {
  const conversations = await prisma.conversation.findMany({
    where: { userId, ...(plantInstanceId ? { plantInstanceId } : {}) },
    orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
  })
  return conversations.map(toConversation)
}

// ─── Ancrage, relu à chaque message ────────────────────────────────────────

/**
 * L'état de l'ancrage **au moment du message**, et non à l'ouverture du fil.
 *
 * Une tâche cochée entre deux questions, des recommandations planifiées
 * depuis : l'agent doit le savoir, sinon il propose de refaire ce qui est
 * fait.
 */
async function buildAnchor(conversation: PrismaConversation): Promise<string> {
  if (conversation.kind === 'diagnosis' && conversation.diagnosisId) {
    const diagnosis = await prisma.diagnosis.findUnique({
      where: { id: conversation.diagnosisId },
      select: { payload: true, createdAt: true, tasksPlannedAt: true },
    })
    const parsed = diagnosis ? diagnosisSuccessSchema.safeParse(diagnosis.payload) : null

    // Un diagnostic supprimé depuis (SetNull) ou illisible ne doit pas rendre
    // le fil inutilisable : on retombe sur une question libre.
    if (!diagnosis || !parsed?.success) return PLANT_ANCHOR

    return diagnosisAnchor(parsed.data, {
      createdAt: diagnosis.createdAt,
      tasksPlanned: diagnosis.tasksPlannedAt !== null,
    })
  }

  if (conversation.kind === 'action') {
    const action = readActionSnapshot(conversation.actionSnapshot)
    if (!action) return PLANT_ANCHOR

    return actionAnchor(action, {
      origin: conversation.taskId
        ? 'Tâche planifiée depuis un diagnostic'
        : `Règle du moteur : ${conversation.actionKey}`,
      done: await isAnchorActionDone(conversation, action),
    })
  }

  return PLANT_ANCHOR
}

/**
 * L'action de l'ancrage a-t-elle été faite ?
 *
 * Une tâche persistée porte sa date d'acquittement. Une action du moteur,
 * elle, n'existe nulle part : le seul témoin est un geste du bon type noté
 * depuis son échéance.
 */
async function isAnchorActionDone(
  conversation: PrismaConversation,
  action: ChatActionSnapshot,
): Promise<boolean> {
  if (conversation.taskId) {
    const task = await prisma.plantTask.findUnique({
      where: { id: conversation.taskId },
      select: { doneAt: true },
    })
    return task?.doneAt != null
  }

  const careType = CARE_LOG_TYPE_BY_ACTION[action.type as ActionType]
  if (!careType) return false

  const log = await prisma.careLog.findFirst({
    where: {
      plantInstanceId: conversation.plantInstanceId,
      type: careType,
      occurredAt: { gte: new Date(`${action.dueDate}T00:00:00.000Z`) },
    },
    select: { id: true },
  })
  return log !== null
}

// ─── Historique ────────────────────────────────────────────────────────────

/**
 * Les derniers tours du fil, en `history` Gemini.
 *
 * Seule la photo du message **courant** part au modèle ; celles des messages
 * passés deviennent une mention. Renvoyer chaque image à chaque tour
 * multiplierait le coût d'un fil par le nombre de photos qu'il contient, pour
 * un gain que la conversation ne réclame presque jamais.
 */
async function loadHistory(conversationId: string, beforeMessageId: string): Promise<ChatTurn[]> {
  const messages = await prisma.message.findMany({
    where: { conversationId, id: { not: beforeMessageId } },
    orderBy: { createdAt: 'desc' },
    take: CHAT_HISTORY_WINDOW,
  })

  return messages
    .reverse()
    .map((message) => ({
      role: message.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: [
        { text: message.photoUrl ? `${message.content}\n[photo jointe]` : message.content },
      ],
    }))
}

// ─── Propositions ──────────────────────────────────────────────────────────

function dueLabel(dueInDays: number, now: Date): string {
  if (dueInDays === 0) return "aujourd'hui"
  if (dueInDays === 1) return 'demain'
  return `le ${shortFrenchDate(new Date(now.getTime() + dueInDays * 24 * HOUR_MS))}`
}

function proposalTitle(draft: ToolCallDraft, conversation: PrismaConversation, now: Date): string {
  switch (draft.kind) {
    case 'plan_task':
      return `Planifier : ${draft.payload.shortLabel} — ${dueLabel(draft.payload.dueInDays, now)}`
    case 'care_log':
      return `Noter : ${CARE_LOG_TYPE_LABELS[draft.payload.type]}`
    case 'mark_done':
      return `Marquer « ${readActionSnapshot(conversation.actionSnapshot)?.shortLabel ?? 'cette action'} » comme faite`
  }
}

/**
 * Retient les propositions exécutables, écarte les autres.
 *
 * Le modèle propose ; c'est ici qu'on décide. Trois règles, toutes tirées de
 * ce qui rendrait la carte absurde à l'écran : cocher une action qui n'est pas
 * l'objet du fil, planifier ce qui l'est déjà, ou noyer la réponse sous les
 * boutons.
 */
async function retainProposals(
  drafts: ToolCallDraft[],
  conversation: PrismaConversation,
  now: Date,
): Promise<ChatProposal[]> {
  const kept: ChatProposal[] = []
  const seen = new Set<string>()

  for (const draft of drafts) {
    if (kept.length >= CHAT_MAX_PROPOSALS) break

    if (draft.kind === 'mark_done') {
      const action = readActionSnapshot(conversation.actionSnapshot)
      if (conversation.kind !== 'action' || !action) continue
      if (await isAnchorActionDone(conversation, action)) continue
    }

    if (draft.kind === 'plan_task') {
      const dueDate = isoDay(now, draft.payload.dueInDays)
      const duplicate = await prisma.plantTask.findFirst({
        where: {
          plantInstanceId: conversation.plantInstanceId,
          type: draft.payload.actionType,
          dueDate,
          doneAt: null,
        },
        select: { id: true },
      })
      if (duplicate) continue
    }

    // Un même geste proposé deux fois dans une réponse ferait deux cartes
    // identiques ; la base ne l'attraperait pas, elles ne sont pas écrites.
    const signature = JSON.stringify([draft.kind, draft.payload])
    if (seen.has(signature)) continue
    seen.add(signature)

    kept.push({
      id: randomUUID(),
      title: proposalTitle(draft, conversation, now),
      acceptedAt: null,
      result: null,
      ...draft,
    } as ChatProposal)
  }

  return kept
}

// ─── Envoi d'un message ────────────────────────────────────────────────────

export type StartedMessage = {
  conversationId: string
  /** Le flux SSE complet, `meta` compris. */
  stream: () => AsyncGenerator<ChatStreamEvent>
}

/**
 * Envoie un message et prépare la réponse en flux.
 *
 * Tout ce qui peut échouer d'un coup — quota, photo illisible, fil d'un autre
 * — est fait **avant** de rendre le générateur : la route doit pouvoir
 * répondre 429 ou 400 en JSON, ce qu'un flux déjà ouvert ne permet plus.
 *
 * @throws ServiceError('NOT_FOUND' | 'QUOTA_EXCEEDED' | 'INVALID_INPUT' | 'UNAVAILABLE')
 */
export async function sendMessage(
  userId: string,
  conversationId: string,
  input: SendMessageInput,
  now: Date = new Date(),
): Promise<StartedMessage> {
  const apiKey = requireGeminiKey('Assistant momentanément indisponible.')

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
  })
  if (!conversation) throw new ServiceError('NOT_FOUND', 'Conversation introuvable')

  const user = await requireUser(userId)
  const quota = await buildQuota(userId, user, now)
  if (quota.remaining !== null && quota.remaining <= 0) {
    throw new ServiceError(
      'QUOTA_EXCEEDED',
      `Tu as utilisé tes ${quota.limit} messages du jour. Ça se réinitialise demain.`,
    )
  }

  let image: GeminiImage | null = null
  let photoUrl: string | null = null
  if (input.imageBase64) {
    image = parseImagePayload(input.imageBase64)
    const stored = await uploadPhoto(userId, 'chat', {
      bytes: toArrayBuffer(image.data),
      contentType: image.mimeType,
    })
    photoUrl = stored.url
  }

  const userMessage = await prisma.message.create({
    data: { conversationId, userId, role: 'user', content: input.content, photoUrl },
  })

  return {
    conversationId,
    stream: () => streamReply({ userId, user, conversation, userMessage, image, apiKey, now }),
  }
}

async function* streamReply(ctx: {
  userId: string
  user: { plan: string; timezone: string }
  conversation: PrismaConversation
  userMessage: PrismaMessage
  image: GeminiImage | null
  apiKey: string
  now: Date
}): AsyncGenerator<ChatStreamEvent> {
  const { conversation, userMessage, now } = ctx
  const startedAt = Date.now()

  yield {
    event: 'meta',
    data: { conversationId: conversation.id, userMessage: toChatMessage(userMessage) },
  }

  const bundle = await buildPlantContext(ctx.userId, conversation.plantInstanceId, now)
  const systemInstruction = buildChatSystemInstruction({
    context: contextBlock(bundle.text, now),
    anchor: await buildAnchor(conversation),
  })

  const history = await loadHistory(conversation.id, userMessage.id)
  const message: ChatPart[] = [
    ...(ctx.image ? [{ inlineData: ctx.image }] : []),
    { text: userMessage.content },
  ]

  let text = ''
  let model: string | null = null
  let failure: string | null = null
  const drafts: ToolCallDraft[] = []

  for await (const event of streamChat({
    apiKey: ctx.apiKey,
    systemInstruction,
    history,
    message,
    tools: CHAT_TOOLS,
    maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
    logLabel: 'chat',
  })) {
    switch (event.type) {
      case 'text':
        text += event.delta
        yield { event: 'text', data: { delta: event.delta } }
        break
      case 'functionCall': {
        const draft = parseToolCall(event.name, event.args)
        if (draft) drafts.push(draft)
        // Un appel hors schéma est ignoré, pas relayé : le client ne doit
        // jamais voir une carte que le serveur ne saurait pas exécuter.
        else console.error(`${LOG} appel d'outil ignoré (${event.name})`, event.args)
        break
      }
      case 'done':
        model = event.model
        break
      case 'error':
        failure = event.reason
        break
    }
  }

  const proposals = await retainProposals(drafts, conversation, now)

  // Un modèle qui n'a rendu que des appels d'outil laisserait des cartes sans
  // un mot pour les présenter.
  if (!text && proposals.length > 0) text = 'Voici ce que je te propose :'

  if (!text) {
    // Rien à montrer : on n'écrit pas de message d'assistant vide dans le fil.
    console.error(`${LOG} réponse sans texte (conversation=${conversation.id})`, failure)
    yield {
      event: 'error',
      data: { code: 'UNAVAILABLE', message: failure ?? GEMINI_FAILURE_MESSAGES.failed },
    }
    return
  }

  const assistantMessage = await prisma.message.create({
    data: {
      conversationId: conversation.id,
      userId: ctx.userId,
      role: 'assistant',
      content: text,
      proposals: proposals.length > 0 ? proposals : undefined,
      model,
    },
  })
  await prisma.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: now },
  })

  console.log(
    `${LOG} réponse conversation=${conversation.id} model=${model ?? 'aucun'} propositions=${proposals.length} durée=${Date.now() - startedAt}ms${failure ? ' interrompue' : ''}`,
  )

  if (proposals.length > 0) yield { event: 'proposals', data: { proposals } }

  // Une panne survenue après les premiers mots laisse le texte reçu — il est
  // persisté, l'utilisateur le retrouvera — mais le tour se termine sur
  // l'erreur : il y a toujours exactement un événement terminal.
  if (failure) {
    yield { event: 'error', data: { code: 'UNAVAILABLE', message: failure } }
    return
  }

  yield {
    event: 'done',
    data: {
      assistantMessage: toChatMessage(assistantMessage),
      quota: await buildQuota(ctx.userId, ctx.user, now),
    },
  }
}

// ─── Confirmation d'une proposition ────────────────────────────────────────

/**
 * Exécute une proposition confirmée par l'utilisateur.
 *
 * Le corps de la requête ne porte que deux identifiants : la proposition
 * exécutée est celle **écrite en base** par le serveur. Un client modifié ne
 * peut donc pas transformer « taille dans quinze jours » en autre chose.
 *
 * Idempotent : reconfirmer rend le message tel quel, sans rien récrire — le
 * bouton peut être tapé deux fois, et deux appareils peuvent afficher le même
 * fil.
 *
 * @throws ServiceError('NOT_FOUND')
 */
export async function acceptProposal(
  userId: string,
  conversationId: string,
  input: AcceptProposalInput,
  now: Date = new Date(),
): Promise<{ message: ChatMessage }> {
  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
  })
  if (!conversation) throw new ServiceError('NOT_FOUND', 'Conversation introuvable')

  const message = await prisma.message.findFirst({
    where: { id: input.messageId, conversationId },
  })
  if (!message) throw new ServiceError('NOT_FOUND', 'Message introuvable')

  const proposals = readProposals(message.proposals)
  const index = proposals?.findIndex((p) => p.id === input.proposalId) ?? -1
  if (!proposals || index < 0) throw new ServiceError('NOT_FOUND', 'Proposition introuvable')

  const proposal = proposals[index]
  if (proposal.acceptedAt) return { message: toChatMessage(message) }

  const result = await executeProposal(userId, conversation, proposal, now)

  const updated = await prisma.message.update({
    where: { id: message.id },
    data: {
      proposals: proposals.map((p, i) =>
        i === index ? { ...p, acceptedAt: now.toISOString(), result } : p,
      ),
    },
  })

  return { message: toChatMessage(updated) }
}

async function executeProposal(
  userId: string,
  conversation: PrismaConversation,
  proposal: ChatProposal,
  now: Date,
): Promise<{ taskId?: string; careLogId?: string }> {
  const plantInstanceId = conversation.plantInstanceId

  if (proposal.kind === 'plan_task') {
    const { actionType, label, shortLabel, dueInDays, priority } = proposal.payload
    const task = await prisma.plantTask.create({
      data: {
        userId,
        plantInstanceId,
        source: 'CHAT',
        type: actionType,
        label,
        shortLabel,
        dueDate: isoDay(now, dueInDays),
        priority: PRIORITY_BY_DIAGNOSIS[priority],
      },
    })
    return { taskId: task.id }
  }

  if (proposal.kind === 'care_log') {
    const { type, note, productUsed, occurredAt } = proposal.payload
    const log = await logCare(plantInstanceId, userId, {
      type,
      note,
      productUsed,
      occurredAt: occurredAt ? new Date(`${occurredAt}T12:00:00.000Z`).toISOString() : undefined,
    })
    return { careLogId: log.id }
  }

  const action = readActionSnapshot(conversation.actionSnapshot)
  if (conversation.kind !== 'action' || !action) {
    throw new ServiceError('NOT_FOUND', "Cette conversation ne porte pas sur une action.")
  }

  const plant = await requirePlant(userId, plantInstanceId)
  const actionType = action.type as ActionType

  if (plant.gardenId) {
    await markActionDone(userId, {
      gardenId: plant.gardenId,
      actionType,
      plantId: plantInstanceId,
      taskId: conversation.taskId ?? undefined,
    })
    return {}
  }

  // Une plante sans jardin ne peut pas passer par `markActionDone`, qui
  // vérifie l'appartenance du jardin et invalide son cache. Le geste et
  // l'acquittement, eux, valent quand même — il n'y a simplement rien à
  // invalider.
  if (conversation.taskId) await completeTask(userId, conversation.taskId, now)
  const careType = CARE_LOG_TYPE_BY_ACTION[actionType]
  if (careType) await logCare(plantInstanceId, userId, { type: careType })
  return {}
}
