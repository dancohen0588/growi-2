import { describe, expect, it } from 'vitest'

import {
  CHAT_MESSAGE_MAX_LENGTH,
  CONVERSATION_KINDS,
  PHOTO_KINDS,
  TASK_SOURCES,
  acceptProposalSchema,
  chatMessageSchema,
  chatProposalSchema,
  chatStreamEventSchema,
  conversationAnchorKey,
  conversationDetailSchema,
  openConversationSchema,
  sendMessageSchema,
} from '../index'

const ACTION = {
  type: 'taille',
  label: 'Taille les tiges les plus atteintes, au-dessus d’un œil.',
  shortLabel: 'Tailler le rosier',
  dueDate: '2026-09-03',
  priority: 'medium',
  source: 'engine',
} as const

const PROPOSAL = {
  id: 'prop_1',
  kind: 'plan_task',
  title: 'Planifier : Pulvériser au bicarbonate — demain',
  payload: {
    actionType: 'traitement',
    shortLabel: 'Pulvériser au bicarbonate',
    label: 'Pulvérise une solution de bicarbonate le matin, feuilles sèches.',
    dueInDays: 1,
    priority: 'soon',
  },
  acceptedAt: null,
  result: null,
}

const MESSAGE = {
  id: 'msg_1',
  conversationId: 'conv_1',
  role: 'assistant',
  content: 'Voici ce que je te propose :',
  photoUrl: null,
  proposals: [PROPOSAL],
  createdAt: '2026-09-01T10:00:00.000Z',
}

describe('ancrage', () => {
  it('couvre les trois points d’entrée du produit', () => {
    expect(CONVERSATION_KINDS).toEqual(['plant', 'diagnosis', 'action'])
  })

  it('accepte une ouverture sur une plante, un diagnostic, une action', () => {
    expect(openConversationSchema.safeParse({ kind: 'plant', plantInstanceId: 'p1' }).success).toBe(
      true,
    )
    expect(
      openConversationSchema.safeParse({ kind: 'diagnosis', plantInstanceId: 'p1', diagnosisId: 'd1' })
        .success,
    ).toBe(true)
    expect(
      openConversationSchema.safeParse({
        kind: 'action',
        plantInstanceId: 'p1',
        taskId: 't1',
        action: ACTION,
      }).success,
    ).toBe(true)
  })

  it('exige un diagnostic pour un fil de diagnostic', () => {
    expect(openConversationSchema.safeParse({ kind: 'diagnosis', plantInstanceId: 'p1' }).success).toBe(
      false,
    )
  })

  it('refuse une action sans origine, ou avec les deux', () => {
    // Une action vient d'une tâche planifiée ou d'une règle du moteur, jamais
    // des deux : sans cette exclusion, la clé d'ancrage serait ambiguë.
    expect(
      openConversationSchema.safeParse({ kind: 'action', plantInstanceId: 'p1', action: ACTION })
        .success,
    ).toBe(false)
    expect(
      openConversationSchema.safeParse({
        kind: 'action',
        plantInstanceId: 'p1',
        taskId: 't1',
        actionKey: 'r1-watering-standard:p1',
        action: ACTION,
      }).success,
    ).toBe(false)
  })

  it('donne une clé distincte à chaque ancrage', () => {
    expect(conversationAnchorKey({ kind: 'plant', plantInstanceId: 'p1' })).toBe('plant:p1')
    expect(
      conversationAnchorKey({ kind: 'diagnosis', plantInstanceId: 'p1', diagnosisId: 'd1' }),
    ).toBe('diagnosis:d1')
    expect(
      conversationAnchorKey({ kind: 'action', plantInstanceId: 'p1', taskId: 't1', action: ACTION }),
    ).toBe('task:t1')
    expect(
      conversationAnchorKey({
        kind: 'action',
        plantInstanceId: 'p1',
        actionKey: 'r1-watering-standard:p1',
        action: ACTION,
      }),
    ).toBe('action:r1-watering-standard:p1')
  })

  it('sépare le fil d’une plante de celui de son diagnostic', () => {
    expect(conversationAnchorKey({ kind: 'plant', plantInstanceId: 'x' })).not.toBe(
      conversationAnchorKey({ kind: 'diagnosis', plantInstanceId: 'x', diagnosisId: 'x' }),
    )
  })
})

describe('propositions', () => {
  it('accepte une planification complète', () => {
    expect(chatProposalSchema.safeParse(PROPOSAL).success).toBe(true)
  })

  it('n’accepte pas les arguments d’une planification sur un autre type', () => {
    // L'union est discriminée par `kind` : `mark_done` ne peut pas voyager
    // avec une échéance, et le serveur ne peut donc pas être poussé à créer
    // une tâche là où l'utilisateur a coché « c'est fait ».
    const parsed = chatProposalSchema.safeParse({ ...PROPOSAL, kind: 'mark_done' })
    expect(parsed.success).toBe(false)
  })

  it('refuse une échéance hors bornes', () => {
    for (const dueInDays of [-1, 61, 1.5]) {
      const parsed = chatProposalSchema.safeParse({
        ...PROPOSAL,
        payload: { ...PROPOSAL.payload, dueInDays },
      })
      expect(parsed.success).toBe(false)
    }
  })

  it('accepte un geste noté, avec ou sans date', () => {
    const base = { ...PROPOSAL, kind: 'care_log', payload: { type: 'watering' } }
    expect(chatProposalSchema.safeParse(base).success).toBe(true)
    expect(
      chatProposalSchema.safeParse({ ...base, payload: { type: 'watering', occurredAt: '2026-09-01' } })
        .success,
    ).toBe(true)
    expect(
      chatProposalSchema.safeParse({ ...base, payload: { type: 'watering', occurredAt: 'hier' } })
        .success,
    ).toBe(false)
  })

  it('accepte un « c’est fait » sans argument', () => {
    expect(
      chatProposalSchema.safeParse({ ...PROPOSAL, kind: 'mark_done', payload: {} }).success,
    ).toBe(true)
  })

  it('porte l’état d’acceptation et ce qu’elle a produit', () => {
    const parsed = chatProposalSchema.safeParse({
      ...PROPOSAL,
      acceptedAt: '2026-09-01T10:05:00.000Z',
      result: { taskId: 'task_1' },
    })
    expect(parsed.success).toBe(true)
  })
})

describe('messages et fil', () => {
  it('valide un message d’assistant avec ses propositions', () => {
    expect(chatMessageSchema.safeParse(MESSAGE).success).toBe(true)
  })

  it('valide un message utilisateur sans proposition ni photo', () => {
    const parsed = chatMessageSchema.safeParse({
      ...MESSAGE,
      role: 'user',
      content: 'Pourquoi mes feuilles jaunissent ?',
      proposals: null,
    })
    expect(parsed.success).toBe(true)
  })

  it('rend le fil avec son quota, illimité compris', () => {
    const detail = {
      id: 'conv_1',
      kind: 'plant',
      title: 'Basilic du balcon',
      plantInstanceId: 'p1',
      diagnosisId: null,
      taskId: null,
      actionKey: null,
      actionSnapshot: null,
      lastMessageAt: null,
      createdAt: '2026-09-01T10:00:00.000Z',
      messages: [MESSAGE],
      quota: { limit: null, used: 3, remaining: null, resetsAt: '2026-09-02T00:00:00.000Z' },
    }
    expect(conversationDetailSchema.safeParse(detail).success).toBe(true)
  })
})

describe('envoi et confirmation', () => {
  it('refuse un message vide et un message trop long', () => {
    expect(sendMessageSchema.safeParse({ content: '   ' }).success).toBe(false)
    expect(sendMessageSchema.safeParse({ content: 'a'.repeat(CHAT_MESSAGE_MAX_LENGTH + 1) }).success).toBe(
      false,
    )
    expect(sendMessageSchema.safeParse({ content: '  Bonjour  ' }).data?.content).toBe('Bonjour')
  })

  it('ne confirme qu’avec des identifiants', () => {
    // Le contenu d'une proposition ne remonte jamais du client : le serveur
    // relit celle qu'il a écrite.
    const parsed = acceptProposalSchema.safeParse({
      messageId: 'msg_1',
      proposalId: 'prop_1',
      payload: { dueInDays: 0 },
    })
    expect(parsed.success).toBe(true)
    expect(parsed.data).toEqual({ messageId: 'msg_1', proposalId: 'prop_1' })
  })
})

describe('flux SSE', () => {
  it('reconnaît chaque événement du protocole', () => {
    const events = [
      { event: 'meta', data: { conversationId: 'conv_1', userMessage: { ...MESSAGE, role: 'user', proposals: null } } },
      { event: 'text', data: { delta: 'Arrose ' } },
      { event: 'proposals', data: { proposals: [PROPOSAL] } },
      {
        event: 'done',
        data: {
          assistantMessage: MESSAGE,
          quota: { limit: 20, used: 4, remaining: 16, resetsAt: '2026-09-02T00:00:00.000Z' },
        },
      },
      { event: 'error', data: { code: 'QUOTA_EXCEEDED', message: 'Tu as utilisé tes messages du jour.' } },
    ]

    for (const event of events) {
      expect(chatStreamEventSchema.safeParse(event).success).toBe(true)
    }
  })

  it('refuse un événement inconnu', () => {
    expect(chatStreamEventSchema.safeParse({ event: 'thinking', data: {} }).success).toBe(false)
  })
})

describe('constantes de rattachement', () => {
  it('range les photos du chat dans leur propre dossier', () => {
    expect(PHOTO_KINDS).toContain('chat')
  })

  it('sait qu’une tâche peut venir du chat', () => {
    expect(TASK_SOURCES).toEqual(['DIAGNOSIS', 'CHAT'])
  })
})
