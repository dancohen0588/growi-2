import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { ChatStreamEvent } from '@growi/shared'

// L'agent conseille et propose ; il n'écrit rien de lui-même. Ce qu'on vérifie
// ici est donc surtout ce qu'il REFUSE : dépasser le quota, proposer deux fois
// la même tâche, cocher une action qui n'est pas l'objet du fil, ou laisser un
// message d'assistant vide dans l'historique.

const prismaMock = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  plantInstance: { findFirst: vi.fn() },
  conversation: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
  message: { count: vi.fn(), create: vi.fn(), findMany: vi.fn() },
  diagnosis: { findUnique: vi.fn(), findFirst: vi.fn() },
  plantTask: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  careLog: { findFirst: vi.fn() },
}))
const gemini = vi.hoisted(() => ({ streamChat: vi.fn() }))
const plantContext = vi.hoisted(() => ({ buildPlantContext: vi.fn() }))
const storage = vi.hoisted(() => ({ uploadPhoto: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/storage', () => storage)
vi.mock('@/lib/services/log.service', () => ({ logCare: vi.fn(), logHealth: vi.fn() }))
vi.mock('@/lib/services/advice.service', () => ({ markActionDone: vi.fn() }))

// Seul l'appel réseau est simulé : la validation d'image et la clé API
// s'exercent pour de vrai, ce sont elles qui gardent la porte.
vi.mock('@/lib/services/gemini', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/services/gemini')>()),
  streamChat: gemini.streamChat,
}))

vi.mock('@/lib/services/plant-context', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/services/plant-context')>()),
  buildPlantContext: plantContext.buildPlantContext,
}))

const { chatDayBounds, getConversation, openConversation, sendMessage } = await import(
  '../chat.service'
)
const { ServiceError } = await import('../errors')

const USER = 'user_1'
const PLANT = 'plant_1'
const CONV = 'conv_1'
const NOW = new Date('2026-09-01T10:00:00.000Z')

const ACTION = {
  type: 'arrosage',
  label: 'Arrose au pied, sans mouiller le feuillage.',
  shortLabel: 'Arroser le basilic',
  dueDate: '2026-09-01',
  priority: 'high',
  source: 'engine',
} as const

function conversationRow(overrides: Record<string, unknown> = {}) {
  return {
    id: CONV,
    userId: USER,
    plantInstanceId: PLANT,
    kind: 'plant',
    diagnosisId: null,
    taskId: null,
    actionKey: null,
    actionSnapshot: null,
    anchorKey: `plant:${PLANT}`,
    title: 'Basilic',
    lastMessageAt: null,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  }
}

function messageRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg_user',
    conversationId: CONV,
    userId: USER,
    role: 'user',
    content: 'Pourquoi mes feuilles jaunissent ?',
    photoUrl: null,
    proposals: null,
    model: null,
    createdAt: NOW,
    ...overrides,
  }
}

/** Le flux tel que le socle Gemini le rend. */
function geminiStream(events: Array<Record<string, unknown>>) {
  return (async function* () {
    for (const event of events) yield event
  })()
}

async function collect(events: AsyncGenerator<ChatStreamEvent>): Promise<ChatStreamEvent[]> {
  const out: ChatStreamEvent[] = []
  for await (const event of events) out.push(event)
  return out
}

/** L'appel passé au modèle lors du dernier envoi. */
function lastPrompt() {
  return gemini.streamChat.mock.calls.at(-1)![0]
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
  process.env.GEMINI_API_KEY = 'clé-de-test'

  prismaMock.user.findUnique.mockResolvedValue({ plan: 'FREE', timezone: 'Europe/Paris' })
  prismaMock.plantInstance.findFirst.mockResolvedValue({
    id: PLANT,
    gardenId: 'garden_1',
    customName: 'Basilic',
    catalogPlant: null,
  })
  prismaMock.conversation.findFirst.mockResolvedValue(conversationRow())
  prismaMock.conversation.findUnique.mockResolvedValue(null)
  prismaMock.conversation.update.mockResolvedValue(conversationRow())
  prismaMock.message.count.mockResolvedValue(0)
  prismaMock.message.findMany.mockResolvedValue([])
  prismaMock.message.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve(messageRow({ id: data.role === 'user' ? 'msg_user' : 'msg_bot', ...data })),
  )
  prismaMock.plantTask.findFirst.mockResolvedValue(null)
  prismaMock.careLog.findFirst.mockResolvedValue(null)
  plantContext.buildPlantContext.mockResolvedValue({ plant: {}, text: 'PLANTE\n- Nom : Basilic' })
  gemini.streamChat.mockReturnValue(geminiStream([{ type: 'done', model: 'gemini-2.5-flash' }]))
})

describe('journée de quota', () => {
  it('bascule à minuit chez l’utilisateur, pas à minuit UTC', () => {
    // 00 h 30 UTC le 1er septembre = 2 h 30 du matin à Paris : c'est encore la
    // journée du 1er, et le compteur ne doit pas s'être remis à zéro à 2 h.
    const { start, resetsAt } = chatDayBounds(new Date('2026-09-01T00:30:00Z'), 'Europe/Paris')

    expect(start.toISOString()).toBe('2026-08-31T22:00:00.000Z')
    expect(resetsAt.toISOString()).toBe('2026-09-01T22:00:00.000Z')
  })

  it('suit le fuseau déclaré', () => {
    const { start } = chatDayBounds(new Date('2026-09-01T10:00:00Z'), 'Pacific/Auckland')
    expect(start.toISOString()).toBe('2026-08-31T12:00:00.000Z')
  })

  it('retombe sur Paris quand le fuseau est inconnu', () => {
    // Un fuseau invalide en base ne doit pas faire échouer une conversation.
    expect(() => chatDayBounds(NOW, 'Mars/Olympus_Mons')).not.toThrow()
  })
})

describe('quota', () => {
  it('plafonne un compte FREE et le dit en français', async () => {
    prismaMock.message.count.mockResolvedValue(20)

    await expect(sendMessage(USER, CONV, { content: 'Bonjour' }, NOW)).rejects.toThrow(
      /20 messages du jour/,
    )
    expect(prismaMock.message.create).not.toHaveBeenCalled()
  })

  it('ne plafonne pas un compte PREMIUM', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ plan: 'PREMIUM', timezone: 'Europe/Paris' })
    prismaMock.message.count.mockResolvedValue(500)

    const started = await sendMessage(USER, CONV, { content: 'Bonjour' }, NOW)
    expect(started.conversationId).toBe(CONV)
  })

  it('rend un quota illimité plutôt qu’un quota à zéro', async () => {
    prismaMock.user.findUnique.mockResolvedValue({ plan: 'PREMIUM', timezone: 'Europe/Paris' })
    prismaMock.message.count.mockResolvedValue(42)
    prismaMock.conversation.findFirst.mockResolvedValue({ ...conversationRow(), messages: [] })

    const detail = await getConversation(USER, CONV, NOW)

    expect(detail.quota).toMatchObject({ limit: null, used: 42, remaining: null })
  })

  it('refuse avant d’écrire quoi que ce soit, pour que la route réponde 429', async () => {
    prismaMock.message.count.mockResolvedValue(20)

    await expect(sendMessage(USER, CONV, { content: 'Bonjour' }, NOW)).rejects.toMatchObject({
      code: 'QUOTA_EXCEEDED',
    })
  })
})

describe('ouverture d’un fil', () => {
  it('retrouve le fil d’un ancrage plutôt que d’en ouvrir un second', async () => {
    prismaMock.conversation.findUnique.mockResolvedValue({
      ...conversationRow(),
      messages: [messageRow()],
    })

    const detail = await openConversation(USER, { kind: 'plant', plantInstanceId: PLANT }, NOW)

    expect(prismaMock.conversation.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_anchorKey: { userId: USER, anchorKey: `plant:${PLANT}` } } }),
    )
    expect(prismaMock.conversation.create).not.toHaveBeenCalled()
    expect(detail.messages).toHaveLength(1)
  })

  it('refuse la plante d’un autre compte', async () => {
    prismaMock.plantInstance.findFirst.mockResolvedValue(null)

    await expect(
      openConversation(USER, { kind: 'plant', plantInstanceId: PLANT }, NOW),
    ).rejects.toThrow(ServiceError)
  })

  it('refuse un diagnostic qui n’est pas celui de la plante', async () => {
    // Sans ce contrôle, citer l'identifiant du diagnostic d'un autre suffirait
    // à s'en faire raconter le contenu par l'agent.
    prismaMock.diagnosis.findFirst.mockResolvedValue(null)

    await expect(
      openConversation(
        USER,
        { kind: 'diagnosis', plantInstanceId: PLANT, diagnosisId: 'diag_autre' },
        NOW,
      ),
    ).rejects.toThrow(/Diagnostic introuvable/)
  })

  it('titre le fil d’une action et en garde le cliché', async () => {
    prismaMock.plantTask.findFirst.mockResolvedValue({ id: 'task_1' })
    prismaMock.conversation.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve(conversationRow(data)),
    )

    const detail = await openConversation(
      USER,
      { kind: 'action', plantInstanceId: PLANT, taskId: 'task_1', action: ACTION },
      NOW,
    )

    expect(detail.title).toBe('Arroser le basilic — Basilic')
    expect(detail.actionSnapshot).toMatchObject({ shortLabel: 'Arroser le basilic' })
  })
})

describe('réponse en flux', () => {
  it('annonce le message, relaie le texte, puis termine sur `done`', async () => {
    gemini.streamChat.mockReturnValue(
      geminiStream([
        { type: 'text', delta: 'Arrose ' },
        { type: 'text', delta: 'ce soir.' },
        { type: 'done', model: 'gemini-2.5-flash' },
      ]),
    )

    const started = await sendMessage(USER, CONV, { content: 'Que faire ?' }, NOW)
    const events = await collect(started.stream())

    expect(events.map((e) => e.event)).toEqual(['meta', 'text', 'text', 'done'])
    expect(prismaMock.message.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'assistant', content: 'Arrose ce soir.' }),
      }),
    )
  })

  it('n’envoie que les 20 derniers tours', async () => {
    const started = await sendMessage(USER, CONV, { content: 'Et sinon ?' }, NOW)
    await collect(started.stream())

    expect(prismaMock.message.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 20, orderBy: { createdAt: 'desc' } }),
    )
  })

  it('remplace les photos passées par une mention', async () => {
    // Renvoyer chaque image à chaque tour multiplierait le coût du fil par le
    // nombre de photos qu'il contient.
    prismaMock.message.findMany.mockResolvedValue([
      messageRow({ id: 'm1', content: 'Regarde', photoUrl: 'https://stockage/1.jpg' }),
    ])

    const started = await sendMessage(USER, CONV, { content: 'Alors ?' }, NOW)
    await collect(started.stream())

    expect(lastPrompt().history).toEqual([
      { role: 'user', parts: [{ text: 'Regarde\n[photo jointe]' }] },
    ])
  })

  it('joint la photo du message courant au modèle', async () => {
    storage.uploadPhoto.mockResolvedValue({ url: 'https://stockage/chat.jpg', path: 'p' })

    const started = await sendMessage(
      USER,
      CONV,
      { content: 'Regarde ça', imageBase64: 'data:image/jpeg;base64,QUJD' },
      NOW,
    )
    await collect(started.stream())

    expect(storage.uploadPhoto).toHaveBeenCalledWith(USER, 'chat', expect.anything())
    expect(lastPrompt().message[0]).toEqual({ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } })
  })

  it('refuse une image invalide avant d’ouvrir le flux', async () => {
    await expect(
      sendMessage(USER, CONV, { content: 'Tiens', imageBase64: 'pas-une-image' }, NOW),
    ).rejects.toThrow(ServiceError)
    expect(prismaMock.message.create).not.toHaveBeenCalled()
  })

  it('n’écrit rien quand le modèle échoue avant le premier mot', async () => {
    gemini.streamChat.mockReturnValue(geminiStream([{ type: 'error', reason: 'Service saturé.' }]))

    const started = await sendMessage(USER, CONV, { content: 'Bonjour' }, NOW)
    const events = await collect(started.stream())

    expect(events.map((e) => e.event)).toEqual(['meta', 'error'])
    // Le message utilisateur reste ; aucun message d'assistant n'est écrit.
    expect(prismaMock.message.create).toHaveBeenCalledTimes(1)
  })

  it('garde le texte reçu quand la panne survient en cours de route', async () => {
    gemini.streamChat.mockReturnValue(
      geminiStream([
        { type: 'text', delta: 'Commence par ' },
        { type: 'error', reason: 'Service saturé.' },
      ]),
    )

    const started = await sendMessage(USER, CONV, { content: 'Bonjour' }, NOW)
    const events = await collect(started.stream())

    expect(events.map((e) => e.event)).toEqual(['meta', 'text', 'error'])
    expect(prismaMock.message.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ role: 'assistant', content: 'Commence par ' }),
      }),
    )
  })
})

describe('propositions', () => {
  const planCall = {
    type: 'functionCall',
    name: 'proposePlanTask',
    args: {
      actionType: 'traitement',
      shortLabel: 'Pulvériser au bicarbonate',
      label: 'Pulvérise une solution de bicarbonate le matin.',
      dueInDays: 1,
      priority: 'soon',
    },
  }

  it('habille un appel valide en carte confirmable', async () => {
    gemini.streamChat.mockReturnValue(
      geminiStream([{ type: 'text', delta: 'Voilà.' }, planCall, { type: 'done', model: 'm' }]),
    )

    const started = await sendMessage(USER, CONV, { content: 'Et l’oïdium ?' }, NOW)
    const events = await collect(started.stream())
    const proposals = events.find((e) => e.event === 'proposals')

    expect(proposals?.data).toMatchObject({
      proposals: [
        {
          kind: 'plan_task',
          title: 'Planifier : Pulvériser au bicarbonate — demain',
          acceptedAt: null,
          result: null,
        },
      ],
    })
  })

  it('ignore un appel hors schéma sans rien montrer au client', async () => {
    gemini.streamChat.mockReturnValue(
      geminiStream([
        { type: 'text', delta: 'Voilà.' },
        { type: 'functionCall', name: 'proposePlanTask', args: { actionType: 'télékinésie' } },
        { type: 'done', model: 'm' },
      ]),
    )

    const started = await sendMessage(USER, CONV, { content: 'Alors ?' }, NOW)
    const events = await collect(started.stream())

    expect(events.some((e) => e.event === 'proposals')).toBe(false)
  })

  it('n’en garde que deux', async () => {
    gemini.streamChat.mockReturnValue(
      geminiStream([
        { type: 'text', delta: 'Voilà.' },
        planCall,
        { ...planCall, args: { ...planCall.args, dueInDays: 2 } },
        { ...planCall, args: { ...planCall.args, dueInDays: 3 } },
        { type: 'done', model: 'm' },
      ]),
    )

    const started = await sendMessage(USER, CONV, { content: 'Alors ?' }, NOW)
    const events = await collect(started.stream())
    const proposals = events.find((e) => e.event === 'proposals')

    expect((proposals?.data as { proposals: unknown[] }).proposals).toHaveLength(2)
  })

  it('ne propose pas de planifier ce qui l’est déjà', async () => {
    prismaMock.plantTask.findFirst.mockResolvedValue({ id: 'task_existante' })
    gemini.streamChat.mockReturnValue(
      geminiStream([{ type: 'text', delta: 'Voilà.' }, planCall, { type: 'done', model: 'm' }]),
    )

    const started = await sendMessage(USER, CONV, { content: 'Alors ?' }, NOW)
    const events = await collect(started.stream())

    expect(events.some((e) => e.event === 'proposals')).toBe(false)
  })

  it('refuse « c’est fait » hors d’un fil d’action', async () => {
    gemini.streamChat.mockReturnValue(
      geminiStream([
        { type: 'text', delta: 'Voilà.' },
        { type: 'functionCall', name: 'proposeMarkDone', args: {} },
        { type: 'done', model: 'm' },
      ]),
    )

    const started = await sendMessage(USER, CONV, { content: 'C’est fait' }, NOW)
    const events = await collect(started.stream())

    expect(events.some((e) => e.event === 'proposals')).toBe(false)
  })

  it('accepte « c’est fait » sur un fil d’action encore ouverte', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(
      conversationRow({ kind: 'action', taskId: 'task_1', actionSnapshot: ACTION }),
    )
    prismaMock.plantTask.findUnique.mockResolvedValue({ doneAt: null })
    gemini.streamChat.mockReturnValue(
      geminiStream([
        { type: 'text', delta: 'Bien joué.' },
        { type: 'functionCall', name: 'proposeMarkDone', args: {} },
        { type: 'done', model: 'm' },
      ]),
    )

    const started = await sendMessage(USER, CONV, { content: 'C’est fait' }, NOW)
    const events = await collect(started.stream())
    const proposals = events.find((e) => e.event === 'proposals')

    expect(proposals?.data).toMatchObject({
      proposals: [{ kind: 'mark_done', title: 'Marquer « Arroser le basilic » comme faite' }],
    })
  })

  it('ne repropose pas de cocher une action déjà faite', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(
      conversationRow({ kind: 'action', taskId: 'task_1', actionSnapshot: ACTION }),
    )
    prismaMock.plantTask.findUnique.mockResolvedValue({ doneAt: NOW })
    gemini.streamChat.mockReturnValue(
      geminiStream([
        { type: 'text', delta: 'Déjà fait.' },
        { type: 'functionCall', name: 'proposeMarkDone', args: {} },
        { type: 'done', model: 'm' },
      ]),
    )

    const started = await sendMessage(USER, CONV, { content: 'C’est fait' }, NOW)
    const events = await collect(started.stream())

    expect(events.some((e) => e.event === 'proposals')).toBe(false)
  })

  it('écrit un texte de présentation quand le modèle n’a rendu que des appels', async () => {
    gemini.streamChat.mockReturnValue(geminiStream([planCall, { type: 'done', model: 'm' }]))

    const started = await sendMessage(USER, CONV, { content: 'Alors ?' }, NOW)
    await collect(started.stream())

    expect(prismaMock.message.create).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ content: 'Voici ce que je te propose :' }),
      }),
    )
  })
})

describe('instruction système', () => {
  it('rappelle l’ancrage d’une action, son origine et son état', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(
      conversationRow({ kind: 'action', actionKey: 'r1-watering-standard:plant_1', actionSnapshot: ACTION }),
    )

    const started = await sendMessage(USER, CONV, { content: 'Comment faire ?' }, NOW)
    await collect(started.stream())

    const instruction = lastPrompt().systemInstruction
    expect(instruction).toContain('ANCRAGE')
    expect(instruction).toContain('Type : action du calendrier.')
    expect(instruction).toContain('Règle du moteur : r1-watering-standard:plant_1')
    expect(instruction).toContain('Déjà faite : non')
    expect(instruction).toContain('PLANTE\n- Nom : Basilic')
  })

  it('recalcule le contexte à chaque message', async () => {
    // La météo change, un geste a pu être noté entre deux questions.
    const started = await sendMessage(USER, CONV, { content: 'Et demain ?' }, NOW)
    await collect(started.stream())

    expect(plantContext.buildPlantContext).toHaveBeenCalledWith(USER, PLANT, NOW)
  })
})
