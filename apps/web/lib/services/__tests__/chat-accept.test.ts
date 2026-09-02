import { beforeEach, describe, expect, it, vi } from 'vitest'

// Confirmer une proposition est le seul moment où l'agent touche aux données
// de l'utilisateur. Ce qui compte ici : c'est la proposition ÉCRITE EN BASE qui
// est exécutée, une seule fois, et seulement si le fil est bien le sien.

const prismaMock = vi.hoisted(() => ({
  conversation: { findFirst: vi.fn() },
  message: { findFirst: vi.fn(), update: vi.fn() },
  plantInstance: { findFirst: vi.fn() },
  plantTask: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
}))
const logService = vi.hoisted(() => ({ logCare: vi.fn(), logHealth: vi.fn() }))
const adviceService = vi.hoisted(() => ({ markActionDone: vi.fn() }))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }))
vi.mock('@/lib/services/log.service', () => logService)
vi.mock('@/lib/services/advice.service', () => adviceService)
vi.mock('@/lib/storage', () => ({ uploadPhoto: vi.fn() }))

const { acceptProposal } = await import('../chat.service')
const { ServiceError } = await import('../errors')

const USER = 'user_1'
const PLANT = 'plant_1'
const CONV = 'conv_1'
const MSG = 'msg_1'
const NOW = new Date('2026-09-01T10:00:00.000Z')

const ACTION = {
  type: 'arrosage',
  label: 'Arrose au pied.',
  shortLabel: 'Arroser le basilic',
  dueDate: '2026-09-01',
  priority: 'high',
  source: 'engine',
}

const PLAN_PROPOSAL = {
  id: 'prop_1',
  kind: 'plan_task',
  title: 'Planifier : Pulvériser au bicarbonate — demain',
  payload: {
    actionType: 'traitement',
    shortLabel: 'Pulvériser au bicarbonate',
    label: 'Pulvérise une solution de bicarbonate le matin.',
    dueInDays: 1,
    priority: 'soon',
  },
  acceptedAt: null,
  result: null,
}

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

function messageRow(proposals: unknown[]) {
  return {
    id: MSG,
    conversationId: CONV,
    userId: USER,
    role: 'assistant',
    content: 'Voici ce que je te propose :',
    photoUrl: null,
    proposals,
    model: 'gemini-2.5-flash',
    createdAt: NOW,
  }
}

/** Les propositions telles qu'elles viennent d'être écrites en base. */
function savedProposals() {
  return prismaMock.message.update.mock.calls.at(-1)![0].data.proposals as Array<
    Record<string, unknown>
  >
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})

  prismaMock.conversation.findFirst.mockResolvedValue(conversationRow())
  prismaMock.message.findFirst.mockResolvedValue(messageRow([PLAN_PROPOSAL]))
  prismaMock.message.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
    Promise.resolve({ ...messageRow(data.proposals as unknown[]) }),
  )
  prismaMock.plantInstance.findFirst.mockResolvedValue({
    id: PLANT,
    gardenId: 'garden_1',
    customName: 'Basilic',
    catalogPlant: null,
  })
  prismaMock.plantTask.create.mockResolvedValue({ id: 'task_neuve' })
  logService.logCare.mockResolvedValue({ id: 'log_neuf' })
})

describe('planifier une tâche', () => {
  it('crée une tâche marquée comme venant du chat', async () => {
    await acceptProposal(USER, CONV, { messageId: MSG, proposalId: 'prop_1' }, NOW)

    expect(prismaMock.plantTask.create).toHaveBeenCalledWith({
      data: {
        userId: USER,
        plantInstanceId: PLANT,
        source: 'CHAT',
        type: 'traitement',
        label: 'Pulvérise une solution de bicarbonate le matin.',
        shortLabel: 'Pulvériser au bicarbonate',
        dueDate: '2026-09-02',
        priority: 'medium',
      },
    })
  })

  it('note sur la carte ce que l’acceptation a produit', async () => {
    const { message } = await acceptProposal(USER, CONV, { messageId: MSG, proposalId: 'prop_1' }, NOW)

    expect(savedProposals()[0]).toMatchObject({
      acceptedAt: NOW.toISOString(),
      result: { taskId: 'task_neuve' },
    })
    expect(message.proposals?.[0].acceptedAt).toBe(NOW.toISOString())
  })
})

describe('noter un geste', () => {
  it('passe par le journal, pour que le geste compte comme les autres', async () => {
    prismaMock.message.findFirst.mockResolvedValue(
      messageRow([
        {
          ...PLAN_PROPOSAL,
          kind: 'care_log',
          payload: { type: 'watering', note: 'Un demi-arrosoir', occurredAt: '2026-08-31' },
        },
      ]),
    )

    await acceptProposal(USER, CONV, { messageId: MSG, proposalId: 'prop_1' }, NOW)

    expect(logService.logCare).toHaveBeenCalledWith(PLANT, USER, {
      type: 'watering',
      note: 'Un demi-arrosoir',
      productUsed: undefined,
      occurredAt: '2026-08-31T12:00:00.000Z',
    })
    expect(savedProposals()[0]).toMatchObject({ result: { careLogId: 'log_neuf' } })
  })
})

describe('cocher une action', () => {
  const markDone = [{ ...PLAN_PROPOSAL, kind: 'mark_done', payload: {} }]

  it('acquitte la tâche et note le geste, par la voie du planning', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(
      conversationRow({ kind: 'action', taskId: 'task_1', actionSnapshot: ACTION }),
    )
    prismaMock.message.findFirst.mockResolvedValue(messageRow(markDone))

    await acceptProposal(USER, CONV, { messageId: MSG, proposalId: 'prop_1' }, NOW)

    expect(adviceService.markActionDone).toHaveBeenCalledWith(USER, {
      gardenId: 'garden_1',
      actionType: 'arrosage',
      plantId: PLANT,
      taskId: 'task_1',
    })
  })

  it('fonctionne aussi pour une plante sans jardin', async () => {
    // `markActionDone` exige un jardin dont il invalide le cache ; sans jardin
    // il n'y a rien à invalider, mais le geste vaut quand même.
    prismaMock.plantInstance.findFirst.mockResolvedValue({
      id: PLANT,
      gardenId: null,
      customName: 'Basilic',
      catalogPlant: null,
    })
    prismaMock.conversation.findFirst.mockResolvedValue(
      conversationRow({ kind: 'action', actionKey: 'r1:plant_1', actionSnapshot: ACTION }),
    )
    prismaMock.message.findFirst.mockResolvedValue(messageRow(markDone))

    await acceptProposal(USER, CONV, { messageId: MSG, proposalId: 'prop_1' }, NOW)

    expect(adviceService.markActionDone).not.toHaveBeenCalled()
    expect(logService.logCare).toHaveBeenCalledWith(PLANT, USER, { type: 'watering' })
  })

  it('refuse de cocher depuis un fil qui ne porte pas sur une action', async () => {
    prismaMock.message.findFirst.mockResolvedValue(messageRow(markDone))

    await expect(
      acceptProposal(USER, CONV, { messageId: MSG, proposalId: 'prop_1' }, NOW),
    ).rejects.toThrow(ServiceError)
    expect(adviceService.markActionDone).not.toHaveBeenCalled()
  })
})

describe('garde-fous', () => {
  it('ne réexécute pas une proposition déjà confirmée', async () => {
    // Le bouton peut être tapé deux fois, et deux appareils peuvent afficher
    // le même fil : reconfirmer rend le message tel quel.
    prismaMock.message.findFirst.mockResolvedValue(
      messageRow([{ ...PLAN_PROPOSAL, acceptedAt: NOW.toISOString(), result: { taskId: 'task_1' } }]),
    )

    const { message } = await acceptProposal(USER, CONV, { messageId: MSG, proposalId: 'prop_1' }, NOW)

    expect(prismaMock.plantTask.create).not.toHaveBeenCalled()
    expect(prismaMock.message.update).not.toHaveBeenCalled()
    expect(message.proposals?.[0].result).toEqual({ taskId: 'task_1' })
  })

  it('refuse le fil d’un autre compte', async () => {
    prismaMock.conversation.findFirst.mockResolvedValue(null)

    await expect(
      acceptProposal(USER, CONV, { messageId: MSG, proposalId: 'prop_1' }, NOW),
    ).rejects.toThrow(/Conversation introuvable/)
  })

  it('refuse un message qui n’appartient pas au fil', async () => {
    prismaMock.message.findFirst.mockResolvedValue(null)

    await expect(
      acceptProposal(USER, CONV, { messageId: 'msg_ailleurs', proposalId: 'prop_1' }, NOW),
    ).rejects.toThrow(/Message introuvable/)
  })

  it('refuse une proposition inventée', async () => {
    await expect(
      acceptProposal(USER, CONV, { messageId: MSG, proposalId: 'prop_inventée' }, NOW),
    ).rejects.toThrow(/Proposition introuvable/)
    expect(prismaMock.plantTask.create).not.toHaveBeenCalled()
  })

  it('exécute la proposition écrite en base, quoi qu’en dise le client', async () => {
    // Le corps de la requête ne porte que deux identifiants : il n'y a rien à
    // falsifier. Le test le fige.
    await acceptProposal(
      USER,
      CONV,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { messageId: MSG, proposalId: 'prop_1', payload: { dueInDays: 60 } } as any,
      NOW,
    )

    expect(prismaMock.plantTask.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ dueDate: '2026-09-02' }) }),
    )
  })
})
