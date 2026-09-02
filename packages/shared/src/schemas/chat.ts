import { z } from 'zod'

import { careLogTypeSchema } from '../constants/enums'
import { idSchema, isoDateTimeSchema, nullish } from './common'
import { diagnosisPrioritySchema } from './diagnosis'
import { actionTypeSchema, gardenActionSchema } from './planning'

/**
 * Agent conversationnel « Growi » — contrats du fil de discussion.
 *
 * L'agent conseille et **propose** ; il n'exécute rien. Une proposition ne
 * devient une tâche ou un geste qu'après confirmation explicite, et le client
 * n'en renvoie jamais le contenu : il envoie `{ messageId, proposalId }`, le
 * serveur relit ce qu'il a lui-même écrit. C'est ce qui empêche une réponse du
 * modèle, ou un client modifié, de faire écrire n'importe quoi.
 */

// ─── Réglages v1 ───────────────────────────────────────────────────────────

/** Messages par jour pour un compte FREE ; PREMIUM n'est pas plafonné. */
export const CHAT_DAILY_LIMIT_FREE = 20

/** Tours d'historique soumis au modèle — au-delà, le coût monte sans éclairer. */
export const CHAT_HISTORY_WINDOW = 20

/** Propositions retenues par réponse : au-delà, la réponse devient un formulaire. */
export const CHAT_MAX_PROPOSALS = 2

export const CHAT_MESSAGE_MAX_LENGTH = 2000

// ─── Ancrage ───────────────────────────────────────────────────────────────

/**
 * Ce sur quoi le fil est ancré.
 *
 * Il n'y a pas de chat « général » en v1 : une conversation part toujours de
 * quelque chose que l'utilisateur a sous les yeux — sa plante, un diagnostic,
 * une action du calendrier. C'est cet ancrage qui donne au modèle de quoi
 * répondre autrement qu'en généralités.
 */
export const CONVERSATION_KINDS = ['plant', 'diagnosis', 'action'] as const
export const conversationKindSchema = z.enum(CONVERSATION_KINDS)
export type ConversationKind = z.infer<typeof conversationKindSchema>

/**
 * L'action telle que l'utilisateur la voyait à l'ouverture du fil.
 *
 * Les actions du moteur ne sont pas persistées et sont recalculées à chaque
 * évaluation : celle qui a fait ouvrir la conversation peut avoir disparu
 * demain. Le fil, lui, doit rester lisible — d'où cette copie.
 */
export const chatActionSnapshotSchema = gardenActionSchema.pick({
  type: true,
  label: true,
  shortLabel: true,
  dueDate: true,
  priority: true,
  source: true,
})

export type ChatActionSnapshot = z.infer<typeof chatActionSnapshotSchema>

/** Corps de `POST /api/v1/conversations` — ouvre le fil de cet ancrage, ou retrouve le sien. */
export const openConversationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('plant'),
    plantInstanceId: idSchema,
  }),
  z.object({
    kind: z.literal('diagnosis'),
    plantInstanceId: idSchema,
    diagnosisId: idSchema,
  }),
  z
    .object({
      kind: z.literal('action'),
      plantInstanceId: idSchema,
      /** Tâche planifiée (`PlantTask.id`), quand l'action en est une. */
      taskId: idSchema.optional(),
      /** Id déterministe d'une action du moteur (`r1-watering-standard:<plantInstanceId>`). */
      actionKey: z.string().min(1).optional(),
      action: chatActionSnapshotSchema,
    })
    .refine((input) => Boolean(input.taskId) !== Boolean(input.actionKey), {
      message: 'Fournir soit taskId, soit actionKey.',
      path: ['taskId'],
    }),
])

export type OpenConversationInput = z.infer<typeof openConversationSchema>

/**
 * Clé d'unicité du fil — une conversation par ancrage.
 *
 * Elle est calculée plutôt que déduite de trois colonnes optionnelles :
 * Postgres tient deux NULL pour distincts, et un index unique sur des colonnes
 * nullables laisserait donc créer autant de fils « plante » qu'on veut.
 */
export function conversationAnchorKey(input: OpenConversationInput): string {
  switch (input.kind) {
    case 'plant':
      return `plant:${input.plantInstanceId}`
    case 'diagnosis':
      return `diagnosis:${input.diagnosisId}`
    case 'action':
      return input.taskId ? `task:${input.taskId}` : `action:${input.actionKey}`
  }
}

// ─── Propositions d'action ─────────────────────────────────────────────────

export const PROPOSAL_KINDS = ['plan_task', 'care_log', 'mark_done'] as const
export const proposalKindSchema = z.enum(PROPOSAL_KINDS)
export type ProposalKind = z.infer<typeof proposalKindSchema>

/** Arguments de `proposePlanTask` — miroir de la déclaration d'outil Gemini. */
export const planTaskProposalPayloadSchema = z.object({
  actionType: actionTypeSchema,
  /** Titre de la carte : 3 à 5 mots. */
  shortLabel: z.string().min(1).max(80),
  /** Consigne complète, qui devient le détail de la tâche. */
  label: z.string().min(1).max(500),
  dueInDays: z.number().int().min(0).max(60),
  priority: diagnosisPrioritySchema,
})

export type PlanTaskProposalPayload = z.infer<typeof planTaskProposalPayloadSchema>

/** Arguments de `proposeCareLog`. */
export const careLogProposalPayloadSchema = z.object({
  type: careLogTypeSchema,
  note: z.string().max(500).optional(),
  productUsed: z.string().max(200).optional(),
  /** Jour du geste, `YYYY-MM-DD` ; aujourd'hui par défaut. */
  occurredAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export type CareLogProposalPayload = z.infer<typeof careLogProposalPayloadSchema>

/**
 * `proposeMarkDone` ne prend rien : elle s'applique à l'ancrage du fil.
 *
 * Strict, et pas un `z.object({})` qui dépouillerait silencieusement ce qu'on
 * lui donne : une acceptation « c'est fait » ne doit jamais pouvoir arriver
 * lestée des arguments d'une planification.
 */
export const markDoneProposalPayloadSchema = z.strictObject({})

/** Ce que l'acceptation a produit — l'UI en tire « Planifié ✓ », « Noté ✓ ». */
export const proposalResultSchema = z.object({
  taskId: idSchema.optional(),
  careLogId: idSchema.optional(),
})

export type ProposalResult = z.infer<typeof proposalResultSchema>

const proposalBase = {
  id: idSchema,
  /** Texte de la carte, ex. « Planifier : Pulvériser au bicarbonate — demain ». */
  title: z.string(),
  acceptedAt: isoDateTimeSchema.nullable(),
  result: proposalResultSchema.nullable(),
}

/**
 * Une proposition portée par un message de l'assistant.
 *
 * L'union est discriminée par `kind` — et non un `payload` en union libre :
 * `mark_done` ne doit pas pouvoir voyager avec les arguments d'une
 * planification, ni l'inverse.
 */
export const chatProposalSchema = z.discriminatedUnion('kind', [
  z.object({
    ...proposalBase,
    kind: z.literal('plan_task'),
    payload: planTaskProposalPayloadSchema,
  }),
  z.object({
    ...proposalBase,
    kind: z.literal('care_log'),
    payload: careLogProposalPayloadSchema,
  }),
  z.object({
    ...proposalBase,
    kind: z.literal('mark_done'),
    payload: markDoneProposalPayloadSchema,
  }),
])

export type ChatProposal = z.infer<typeof chatProposalSchema>

// ─── Messages et conversations ─────────────────────────────────────────────

export const CHAT_ROLES = ['user', 'assistant'] as const
export const chatRoleSchema = z.enum(CHAT_ROLES)
export type ChatRole = z.infer<typeof chatRoleSchema>

export const chatMessageSchema = z.object({
  id: idSchema,
  conversationId: idSchema,
  role: chatRoleSchema,
  content: z.string(),
  photoUrl: nullish(z.string()),
  /** `null` sur un message utilisateur, et sur une réponse sans proposition. */
  proposals: z.array(chatProposalSchema).nullable(),
  createdAt: isoDateTimeSchema,
})

export type ChatMessage = z.infer<typeof chatMessageSchema>

export const conversationSchema = z.object({
  id: idSchema,
  kind: conversationKindSchema,
  /** En-tête du fil : nom de la plante, « Diagnostic du 3 sept. », « Tailler — Rosier ». */
  title: z.string(),
  plantInstanceId: idSchema,
  diagnosisId: nullish(z.string()),
  taskId: nullish(z.string()),
  actionKey: nullish(z.string()),
  actionSnapshot: nullish(chatActionSnapshotSchema),
  lastMessageAt: nullish(isoDateTimeSchema),
  createdAt: isoDateTimeSchema,
})

export type Conversation = z.infer<typeof conversationSchema>
export const conversationsSchema = z.array(conversationSchema)

/**
 * Ce qu'il reste de messages aujourd'hui.
 *
 * `limit` et `remaining` valent `null` pour un compte sans plafond : c'est
 * « illimité », et non « zéro ».
 */
export const chatQuotaSchema = z.object({
  limit: z.number().int().nullable(),
  used: z.number().int(),
  remaining: z.number().int().nullable(),
  /** Minuit suivant, dans le fuseau de l'utilisateur. */
  resetsAt: isoDateTimeSchema,
})

export type ChatQuota = z.infer<typeof chatQuotaSchema>

export const conversationDetailSchema = conversationSchema.extend({
  messages: z.array(chatMessageSchema),
  quota: chatQuotaSchema,
})

export type ConversationDetail = z.infer<typeof conversationDetailSchema>

// ─── Envoi d'un message ────────────────────────────────────────────────────

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1).max(CHAT_MESSAGE_MAX_LENGTH),
  /** Data URL, même limite de 4 Mo que le diagnostic. */
  imageBase64: z.string().optional(),
})

export type SendMessageInput = z.infer<typeof sendMessageSchema>

/**
 * Corps de `POST …/proposals/accept`.
 *
 * Rien du contenu de la proposition ne transite ici : le serveur relit celle
 * qu'il a écrite. Un client qui enverrait « arrose dans 0 jour » à la place de
 * « taille dans 15 jours » ne changerait donc rien.
 */
export const acceptProposalSchema = z.object({
  messageId: idSchema,
  proposalId: idSchema,
})

export type AcceptProposalInput = z.infer<typeof acceptProposalSchema>

export const acceptProposalResponseSchema = z.object({ message: chatMessageSchema })
export type AcceptProposalResponse = z.infer<typeof acceptProposalResponseSchema>

// ─── Flux SSE ──────────────────────────────────────────────────────────────

/**
 * Les événements de `POST …/messages`, dans l'ordre :
 * `meta` → `text`* → `proposals`? → `done`, ou `error` à la place du reste.
 *
 * `error` peut suivre des `text` déjà émis : un flux coupé en route laisse à
 * l'écran ce qui est arrivé, et l'utilisateur relance.
 */
export const chatStreamEventSchema = z.discriminatedUnion('event', [
  z.object({
    event: z.literal('meta'),
    data: z.object({ conversationId: idSchema, userMessage: chatMessageSchema }),
  }),
  z.object({
    event: z.literal('text'),
    data: z.object({ delta: z.string() }),
  }),
  z.object({
    event: z.literal('proposals'),
    data: z.object({ proposals: z.array(chatProposalSchema) }),
  }),
  z.object({
    event: z.literal('done'),
    data: z.object({ assistantMessage: chatMessageSchema, quota: chatQuotaSchema }),
  }),
  z.object({
    event: z.literal('error'),
    data: z.object({ code: z.string(), message: z.string() }),
  }),
])

export type ChatStreamEvent = z.infer<typeof chatStreamEventSchema>
